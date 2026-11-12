from starlette.routing import Route

from ..core.http import ApiError, endpoint, now_iso, pid, today
from ..db.database import q, q1, raw1
from ..schemas import CommentIn, MembersPut, ProjectIn, ProjectUpdate
from ..services.common import (ADMIN, PM, MEMBER, can_manage_project, check_client_exists, check_user_exists,
                               deadline_flags, get_project_row, log, require_manage, require_view)

STAFF = [ADMIN, PM]

PROJECT_SELECT = """
SELECT p.*, c.name AS client_name, u.name AS manager_name, u.avatar_color AS manager_color,
  (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.deleted_at IS NULL) AS task_total,
  (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.deleted_at IS NULL AND t.status='Done') AS task_done,
  (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.deleted_at IS NULL AND t.status!='Done'
        AND t.due_date IS NOT NULL AND t.due_date < ?) AS task_overdue
FROM projects p LEFT JOIN clients c ON c.id=p.client_id LEFT JOIN users u ON u.id=p.manager_id
WHERE p.deleted_at IS NULL"""


def decorate(db, p):
    p["progress"] = round(100 * p["task_done"] / p["task_total"]) if p["task_total"] else 0
    p["overdue"], p["due_soon"], p["days_left"] = deadline_flags(p.get("deadline"), p["status"])
    p["members"] = q(db, """SELECT u.id,u.name,u.avatar_color,u.title,m.project_role FROM project_members m
                            JOIN users u ON u.id=m.user_id WHERE m.project_id=? ORDER BY u.name""", (p["id"],))
    return p


def _visible_filter(user):
    if user["role"] in (ADMIN, PM):
        return "", []
    return (" AND (p.id IN (SELECT project_id FROM project_members WHERE user_id=?)"
            " OR p.id IN (SELECT project_id FROM tasks WHERE assignee_id=? AND deleted_at IS NULL))"), [user["id"]] * 2


@endpoint()
def list_projects(request, db, user):
    qp = request.query_params
    sql, params = PROJECT_SELECT, [today().isoformat()]
    extra, ep = _visible_filter(user)
    sql += extra; params += ep
    for key, col in (("status", "p.status"), ("client_id", "p.client_id"), ("manager_id", "p.manager_id"),
                     ("priority", "p.priority")):
        if qp.get(key):
            sql += f" AND {col}=?"; params.append(qp[key])
    if qp.get("search"):
        sql += " AND (p.name LIKE ? OR c.name LIKE ?)"; params += [f"%{qp['search']}%"] * 2
    sql += " ORDER BY CASE p.status WHEN 'Active' THEN 0 WHEN 'Planning' THEN 1 WHEN 'On Hold' THEN 2 ELSE 3 END, p.deadline IS NULL, p.deadline"
    return [decorate(db, p) for p in q(db, sql, params)]


@endpoint()
def get_project(request, db, user):
    row = get_project_row(db, pid(request))
    require_view(db, user, row)
    p = q1(db, PROJECT_SELECT + " AND p.id=?", (today().isoformat(), row["id"]))
    p = decorate(db, p)
    p["can_manage"] = can_manage_project(user, row)
    return p


@endpoint(roles=STAFF, model=ProjectIn)
def create_project(request, db, user, d: ProjectIn):
    check_client_exists(db, d.client_id)
    manager_id = d.manager_id if user["role"] == ADMIN and d.manager_id else user["id"]
    if user["role"] == ADMIN and d.manager_id:
        mgr = raw1(db, "SELECT role FROM users WHERE id=? AND active=1", (d.manager_id,))
        if not mgr or mgr["role"] not in (ADMIN, PM):
            raise ApiError(422, "validation_error", "Validation failed",
                           [{"field": "manager_id", "message": "Manager must be an Admin or Project Manager"}])
    for uid in d.member_ids:
        check_user_exists(db, uid, "member_ids")
    now = now_iso()
    cur = db.execute(
        """INSERT INTO projects (name,description,client_id,manager_id,status,priority,start_date,deadline,budget,
           created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (d.name, d.description, d.client_id, manager_id, d.status, d.priority, d.start_date, d.deadline, d.budget, now, now))
    pid_ = cur.lastrowid
    db.execute("INSERT OR IGNORE INTO project_members VALUES (?,?,?)", (pid_, manager_id, "Project Manager"))
    for uid in d.member_ids:
        db.execute("INSERT OR IGNORE INTO project_members VALUES (?,?,?)", (pid_, uid, "Contributor"))
    log(db, user["id"], "project", pid_, pid_, "created_project", d.name)
    return get_project_inner(db, user, pid_), 201


def get_project_inner(db, user, project_id):
    p = decorate(db, q1(db, PROJECT_SELECT + " AND p.id=?", (today().isoformat(), project_id)))
    p["can_manage"] = True
    return p


@endpoint(model=ProjectUpdate)
def update_project(request, db, user, d: ProjectUpdate):
    row = get_project_row(db, pid(request))
    require_manage(user, row)
    ch = d.model_dump(exclude_unset=True)
    if "client_id" in ch:
        check_client_exists(db, ch["client_id"])
    if "manager_id" in ch:
        if user["role"] != ADMIN:
            raise ApiError(403, "forbidden", "Only an admin can reassign the project manager")
        mgr = raw1(db, "SELECT role FROM users WHERE id=? AND active=1", (ch["manager_id"],))
        if not mgr or mgr["role"] not in (ADMIN, PM):
            raise ApiError(422, "validation_error", "Validation failed",
                           [{"field": "manager_id", "message": "Manager must be an Admin or Project Manager"}])
        db.execute("INSERT OR IGNORE INTO project_members VALUES (?,?,?)", (row["id"], ch["manager_id"], "Project Manager"))
    s, e = ch.get("start_date", row["start_date"]), ch.get("deadline", row["deadline"])
    if s and e and e < s:
        raise ApiError(422, "validation_error", "Validation failed",
                       [{"field": "deadline", "message": "deadline must be on or after start_date"}])
    if ch:
        db.execute(f"UPDATE projects SET {', '.join(k + '=?' for k in ch)}, updated_at=? WHERE id=?",
                   list(ch.values()) + [now_iso(), row["id"]])
        detail = f"status → {ch['status']}" if "status" in ch else ", ".join(ch)
        log(db, user["id"], "project", row["id"], row["id"], "updated_project", detail)
    return get_project_inner(db, user, row["id"])


@endpoint(roles=[ADMIN])
def delete_project(request, db, user):
    row = get_project_row(db, pid(request))
    db.execute("UPDATE projects SET deleted_at=?, updated_at=? WHERE id=?", (now_iso(), now_iso(), row["id"]))
    log(db, user["id"], "project", row["id"], None, "deleted_project", row["name"])
    return {"ok": True}


@endpoint(model=MembersPut)
def put_members(request, db, user, d: MembersPut):
    row = get_project_row(db, pid(request))
    require_manage(user, row)
    for m in d.members:
        check_user_exists(db, m.user_id, "members")
    db.execute("DELETE FROM project_members WHERE project_id=? AND user_id!=?", (row["id"], row["manager_id"]))
    for m in d.members:
        db.execute("INSERT OR REPLACE INTO project_members VALUES (?,?,?)",
                   (row["id"], m.user_id, "Project Manager" if m.user_id == row["manager_id"] else m.project_role))
    log(db, user["id"], "project", row["id"], row["id"], "updated_team", f"{len(d.members)} members")
    return get_project_inner(db, user, row["id"])["members"]


@endpoint()
def list_comments(request, db, user):
    row = get_project_row(db, pid(request))
    require_view(db, user, row)
    return q(db, """SELECT c.*, u.name AS author_name, u.avatar_color AS author_color, u.role AS author_role
                    FROM project_comments c JOIN users u ON u.id=c.author_id WHERE c.project_id=?
                    ORDER BY c.created_at DESC, c.id DESC""", (row["id"],))


@endpoint(model=CommentIn)
def add_comment(request, db, user, d: CommentIn):
    row = get_project_row(db, pid(request))
    require_view(db, user, row)
    cur = db.execute("INSERT INTO project_comments (project_id,author_id,body,created_at) VALUES (?,?,?,?)",
                     (row["id"], user["id"], d.body.strip(), now_iso()))
    log(db, user["id"], "project", row["id"], row["id"], "posted_update", d.body[:80])
    return q1(db, """SELECT c.*, u.name AS author_name, u.avatar_color AS author_color, u.role AS author_role
                     FROM project_comments c JOIN users u ON u.id=c.author_id WHERE c.id=?""", (cur.lastrowid,)), 201


ACTIVITY_SELECT = """SELECT a.*, u.name AS actor_name, u.avatar_color AS actor_color, p.name AS project_name
  FROM activity_logs a LEFT JOIN users u ON u.id=a.actor_id LEFT JOIN projects p ON p.id=a.project_id"""


@endpoint()
def project_activity(request, db, user):
    row = get_project_row(db, pid(request))
    require_view(db, user, row)
    return q(db, ACTIVITY_SELECT + " WHERE a.project_id=? ORDER BY a.created_at DESC, a.id DESC LIMIT 60", (row["id"],))


@endpoint()
def global_activity(request, db, user):
    sql, params = ACTIVITY_SELECT + " WHERE a.action!='logged_in'", []
    if user["role"] == MEMBER:
        sql += " AND (a.actor_id=? OR a.project_id IN (SELECT project_id FROM project_members WHERE user_id=?))"
        params += [user["id"]] * 2
    limit = min(int(request.query_params.get("limit", 40)), 200)
    return q(db, sql + " ORDER BY a.created_at DESC, a.id DESC LIMIT ?", params + [limit])


routes = [
    Route("/projects", list_projects, methods=["GET"]),
    Route("/projects", create_project, methods=["POST"]),
    Route("/projects/{id}", get_project, methods=["GET"]),
    Route("/projects/{id}", update_project, methods=["PATCH"]),
    Route("/projects/{id}", delete_project, methods=["DELETE"]),
    Route("/projects/{id}/members", put_members, methods=["PUT"]),
    Route("/projects/{id}/comments", list_comments, methods=["GET"]),
    Route("/projects/{id}/comments", add_comment, methods=["POST"]),
    Route("/projects/{id}/activity", project_activity, methods=["GET"]),
    Route("/activity", global_activity, methods=["GET"]),
]
