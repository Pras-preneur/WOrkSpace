"""Dashboard + analytics endpoints. Aggregates are computed server-side with SQL."""
from datetime import date, datetime, timedelta, timezone

from starlette.routing import Route

from ..core import config
from ..core.http import ApiError, endpoint, today
from ..db.database import q, raw1
from ..services.common import ADMIN, PM, MEMBER, TASK_SELECT, decorate_task
from .projects import ACTIVITY_SELECT

STAFF = [ADMIN, PM]


def _days(request, default=30):
    try:
        d = int(request.query_params.get("days", default))
    except ValueError:
        raise ApiError(400, "bad_query", "days must be an integer")
    return max(1, min(d, 365))


def _scope(user):
    """SQL fragment limiting tasks (alias t) and projects (alias p) to what the viewer may see."""
    if user["role"] == ADMIN:
        return "organization", "1=1", "1=1", []
    if user["role"] == PM:
        return ("managed", "t.project_id IN (SELECT id FROM projects WHERE manager_id=? AND deleted_at IS NULL)",
                "p.manager_id=?", [user["id"]])
    return ("personal", "t.assignee_id=?",
            "(p.id IN (SELECT project_id FROM project_members WHERE user_id=?))", [user["id"]])


BASE_TASKS = "FROM tasks t JOIN projects p ON p.id=t.project_id AND p.deleted_at IS NULL WHERE t.deleted_at IS NULL AND "


def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


@endpoint()
def overview(request, db, user):
    days = _days(request)
    scope, tcl, pcl, sp = _scope(user)
    td = today()
    t_iso, since = td.isoformat(), (td - timedelta(days=days)).isoformat()
    week_end = (td + timedelta(days=7)).isoformat()

    by_status = {r["status"]: r["n"] for r in q(db, f"SELECT t.status, COUNT(*) AS n {BASE_TASKS}{tcl} GROUP BY t.status", sp)}
    tasks_by_status = [{"status": s, "count": by_status.get(s, 0)} for s in config.TASK_STATUSES]
    total = sum(by_status.values())

    proj_rows = q(db, f"SELECT p.status, COUNT(*) AS n FROM projects p WHERE p.deleted_at IS NULL AND {pcl} GROUP BY p.status", sp)
    pmap = {r["status"]: r["n"] for r in proj_rows}
    projects_by_status = [{"status": s, "count": pmap.get(s, 0)} for s in config.PROJECT_STATUSES]

    counts = raw1(db, f"""SELECT
        SUM(CASE WHEN t.status!='Done' THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN t.status!='Done' AND t.due_date IS NOT NULL AND t.due_date < ? THEN 1 ELSE 0 END) AS overdue,
        SUM(CASE WHEN t.status!='Done' AND t.due_date BETWEEN ? AND ? THEN 1 ELSE 0 END) AS due_week,
        SUM(CASE WHEN t.status='Done' AND substr(t.completed_at,1,10) >= ? THEN 1 ELSE 0 END) AS completed_period,
        SUM(CASE WHEN t.status='Blocked' THEN 1 ELSE 0 END) AS blocked
        {BASE_TASKS}{tcl}""", [t_iso, t_iso, week_end, since] + sp)
    counts = {k: (v or 0) for k, v in counts.items()}
    done = by_status.get("Done", 0)

    # completed vs created per week, last 8 weeks
    start = _week_start(td) - timedelta(weeks=7)
    weeks = [{"week_start": (start + timedelta(weeks=i)).isoformat(),
              "label": (start + timedelta(weeks=i)).strftime("%d %b"), "completed": 0, "created": 0} for i in range(8)]
    idx = {w["week_start"]: w for w in weeks}
    for r in q(db, f"SELECT t.created_at, t.completed_at {BASE_TASKS}{tcl} AND (t.created_at >= ? OR t.completed_at >= ?)",
               sp + [start.isoformat()] * 2):
        for key, col in (("created", "created_at"), ("completed", "completed_at")):
            if r[col]:
                ws = _week_start(date.fromisoformat(r[col][:10]))
                if ws.isoformat() in idx:
                    idx[ws.isoformat()][key] += 1

    # workload per active member (open tasks in scope)
    wl = q(db, f"""SELECT u.id AS user_id, u.name, u.avatar_color AS color,
        SUM(CASE WHEN t.status!='Done' THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN t.status!='Done' AND t.due_date IS NOT NULL AND t.due_date < ? THEN 1 ELSE 0 END) AS overdue
        FROM tasks t JOIN projects p ON p.id=t.project_id AND p.deleted_at IS NULL
        JOIN users u ON u.id=t.assignee_id AND u.active=1
        WHERE t.deleted_at IS NULL AND {tcl} GROUP BY u.id ORDER BY open DESC""", [t_iso] + sp)
    workload = [{**w, "open": w["open"] or 0, "overdue": w["overdue"] or 0} for w in wl]

    # upcoming deadlines (tasks + projects), next 14 days incl. overdue open ones
    horizon = (td + timedelta(days=14)).isoformat()
    upcoming = []
    for t in q(db, TASK_SELECT + f" WHERE t.deleted_at IS NULL AND t.status!='Done' AND t.due_date IS NOT NULL AND "
               f"t.due_date <= ? AND {tcl} ORDER BY t.due_date LIMIT 12", [horizon] + sp):
        decorate_task(t)
        upcoming.append({"type": "task", "id": t["id"], "project_id": t["project_id"], "title": t["title"],
                         "project_name": t["project_name"], "due_date": t["due_date"], "days_left": t["days_left"],
                         "priority": t["priority"], "status": t["status"], "assignee_name": t["assignee_name"],
                         "overdue": t["overdue"]})
    if scope != "personal":
        for p in q(db, f"SELECT p.id,p.name,p.deadline,p.priority,p.status FROM projects p WHERE p.deleted_at IS NULL "
                   f"AND p.status IN ('Planning','Active') AND p.deadline IS NOT NULL AND p.deadline BETWEEN ? AND ? AND {pcl}",
                   [t_iso, horizon] + sp):
            upcoming.append({"type": "project", "id": p["id"], "project_id": p["id"], "title": p["name"],
                             "project_name": p["name"], "due_date": p["deadline"], "priority": p["priority"],
                             "days_left": (date.fromisoformat(p["deadline"]) - td).days, "status": p["status"],
                             "assignee_name": None, "overdue": False})
    upcoming.sort(key=lambda x: (x["due_date"], x["type"]))
    upcoming = upcoming[:10]

    # projects at risk
    at_risk = []
    for p in q(db, f"""SELECT p.id,p.name,p.deadline,p.priority,c.name AS client_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.deleted_at IS NULL) AS total,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.deleted_at IS NULL AND t.status='Done') AS done,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.deleted_at IS NULL AND t.status!='Done'
              AND t.due_date IS NOT NULL AND t.due_date < ?) AS overdue,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.deleted_at IS NULL AND t.status='Blocked') AS blocked
        FROM projects p LEFT JOIN clients c ON c.id=p.client_id
        WHERE p.deleted_at IS NULL AND p.status='Active' AND {pcl}""", [t_iso] + sp):
        progress = round(100 * p["done"] / p["total"]) if p["total"] else 0
        reasons = []
        if p["overdue"]:
            reasons.append(f"{p['overdue']} overdue task{'s' if p['overdue'] > 1 else ''}")
        if p["blocked"]:
            reasons.append(f"{p['blocked']} blocked")
        if p["deadline"]:
            dl = (date.fromisoformat(p["deadline"]) - td).days
            if dl < 0:
                reasons.append(f"deadline passed {-dl}d ago")
            elif dl <= 7 and progress < 70:
                reasons.append(f"due in {dl}d at {progress}%")
        if reasons:
            at_risk.append({**p, "progress": progress, "reasons": reasons})
    at_risk.sort(key=lambda x: (-x["overdue"], x["deadline"] or "9999"))

    activity_sql = ACTIVITY_SELECT + " WHERE a.action!='logged_in'"
    ap = []
    if scope == "managed":
        activity_sql += " AND (a.project_id IN (SELECT id FROM projects WHERE manager_id=?) OR a.actor_id=?)"; ap = [user["id"]] * 2
    elif scope == "personal":
        activity_sql += " AND (a.actor_id=? OR a.project_id IN (SELECT project_id FROM project_members WHERE user_id=?))"; ap = [user["id"]] * 2
    recent = q(db, activity_sql + " ORDER BY a.created_at DESC, a.id DESC LIMIT 8", ap)

    return {
        "scope": scope, "days": days,
        "kpis": {
            "active_projects": pmap.get("Active", 0), "total_tasks": total, "open_tasks": counts["open"],
            "overdue_tasks": counts["overdue"], "due_this_week": counts["due_week"], "blocked_tasks": counts["blocked"],
            "completed_in_period": counts["completed_period"],
            "completion_rate": round(100 * done / total) if total else 0,
        },
        "tasks_by_status": tasks_by_status, "projects_by_status": projects_by_status,
        "completed_per_week": weeks, "workload": workload, "upcoming_deadlines": upcoming,
        "at_risk_projects": at_risk, "recent_activity": recent,
    }


@endpoint(roles=STAFF)
def team_performance(request, db, user):
    days = _days(request)
    scope, tcl, _, sp = _scope(user)
    td = today()
    t_iso, since = td.isoformat(), (td - timedelta(days=days)).isoformat()
    users = q(db, "SELECT id,name,title,role,avatar_color,primary_responsibility FROM users WHERE active=1 AND role!='Client' ORDER BY name")
    rows = q(db, f"SELECT t.assignee_id, t.status, t.due_date, t.created_at, t.completed_at {BASE_TASKS}{tcl} AND t.assignee_id IS NOT NULL", sp)
    out = []
    for u in users:
        mine = [r for r in rows if r["assignee_id"] == u["id"]]
        if not mine and scope == "managed":
            continue
        done_period = [r for r in mine if r["status"] == "Done" and (r["completed_at"] or "")[:10] >= since]
        with_due = [r for r in done_period if r["due_date"]]
        on_time = [r for r in with_due if r["completed_at"][:10] <= r["due_date"]]
        durations = [(datetime.fromisoformat(r["completed_at"]) - datetime.fromisoformat(r["created_at"])).total_seconds() / 86400
                     for r in done_period if r["completed_at"]]
        out.append({
            **u, "assigned": len(mine),
            "open": sum(1 for r in mine if r["status"] != "Done"),
            "completed": len(done_period),
            "overdue": sum(1 for r in mine if r["status"] != "Done" and r["due_date"] and r["due_date"] < t_iso),
            "on_time_pct": round(100 * len(on_time) / len(with_due)) if with_due else None,
            "avg_completion_days": round(sum(durations) / len(durations), 1) if durations else None,
            "completion_rate": round(100 * sum(1 for r in mine if r["status"] == "Done") / len(mine)) if mine else 0,
        })
    team = {
        "assigned": sum(o["assigned"] for o in out), "completed": sum(o["completed"] for o in out),
        "overdue": sum(o["overdue"] for o in out), "open": sum(o["open"] for o in out),
    }
    return {"days": days, "members": out, "team": team}


@endpoint(roles=STAFF)
def project_analytics(request, db, user):
    scope, _, pcl, sp = _scope(user)
    t_iso = today().isoformat()
    rows = q(db, f"""SELECT p.id,p.name,p.status,p.priority,p.deadline,c.name AS client_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.deleted_at IS NULL) AS total,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.deleted_at IS NULL AND t.status='Done') AS done,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.deleted_at IS NULL AND t.status!='Done'
              AND t.due_date IS NOT NULL AND t.due_date < ?) AS overdue,
        (SELECT COALESCE(SUM(estimated_hours),0) FROM tasks t WHERE t.project_id=p.id AND t.deleted_at IS NULL) AS est_hours
        FROM projects p LEFT JOIN clients c ON c.id=p.client_id WHERE p.deleted_at IS NULL AND {pcl} ORDER BY p.deadline""",
               [t_iso] + sp)
    for r in rows:
        r["progress"] = round(100 * r["done"] / r["total"]) if r["total"] else 0
    return rows


@endpoint()
def notifications(request, db, user):
    """Computed in-app notifications (deadlines + recent assignments). Persisted/emailed in Phase 4."""
    td = today()
    items = []
    for t in q(db, TASK_SELECT + " WHERE t.deleted_at IS NULL AND t.assignee_id=? AND t.status!='Done' AND "
               "t.due_date IS NOT NULL AND t.due_date <= ? ORDER BY t.due_date",
               (user["id"], (td + timedelta(days=config.DUE_SOON_DAYS)).isoformat())):
        decorate_task(t)
        if t["overdue"]:
            msg, kind = f"Overdue by {-t['days_left']} day{'s' if t['days_left'] != -1 else ''}", "overdue"
        else:
            msg, kind = ("Due today" if t["days_left"] == 0 else f"Due in {t['days_left']} day{'s' if t['days_left'] != 1 else ''}"), "due_soon"
        items.append({"kind": kind, "task_id": t["id"], "project_id": t["project_id"], "title": t["title"],
                      "message": msg, "project_name": t["project_name"], "at": t["due_date"]})
    since = (datetime.now(timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%S")
    for a in q(db, """SELECT a.entity_id AS task_id, a.project_id, a.detail, a.created_at, u.name AS actor FROM activity_logs a
                      JOIN tasks t ON t.id=a.entity_id JOIN users u ON u.id=a.actor_id
                      WHERE a.action='assigned' AND t.assignee_id=? AND a.actor_id!=? AND a.created_at>=?
                      ORDER BY a.created_at DESC LIMIT 5""", (user["id"], user["id"], since)):
        items.append({"kind": "assigned", "task_id": a["task_id"], "project_id": a["project_id"],
                      "title": a["detail"].split(" → ")[0], "message": f"Assigned to you by {a['actor']}",
                      "project_name": None, "at": a["created_at"]})
    return {"count": len(items), "items": items}


routes = [
    Route("/dashboard/overview", overview, methods=["GET"]),
    Route("/analytics/team", team_performance, methods=["GET"]),
    Route("/analytics/projects", project_analytics, methods=["GET"]),
    Route("/notifications", notifications, methods=["GET"]),
]
