from starlette.routing import Route

from ..core.http import ApiError, endpoint, now_iso, pid, today
from ..db.database import bool_done, q, q1, raw1
from ..schemas import CommentIn, SubtaskIn, SubtaskUpdate, TaskIn, TaskMove, TaskUpdate
from ..services.common import (ADMIN, PM, MEMBER, TASK_SELECT, can_manage_project, check_user_exists, decorate_task,
                               get_project_row, get_task, jdump, log, require_manage, require_view)


def _task_access(db, user, task):
    """Return (project_row, can_manage, is_assignee) and enforce view access."""
    proj = get_project_row(db, task["project_id"])
    require_view(db, user, proj)
    return proj, can_manage_project(user, proj), task["assignee_id"] == user["id"]


def _full(db, task_id, user=None):
    t = get_task(db, task_id)
    if user is not None:
        proj = get_project_row(db, t["project_id"])
        t["can_manage"] = can_manage_project(user, proj)
        t["can_edit"] = t["can_manage"] or t["assignee_id"] == user["id"]
    t["subtasks"] = [bool_done(s) for s in q(db, "SELECT * FROM subtasks WHERE task_id=? ORDER BY id", (task_id,))]
    t["comments"] = q(db, """SELECT c.*, u.name AS author_name, u.avatar_color AS author_color FROM task_comments c
                             JOIN users u ON u.id=c.author_id WHERE c.task_id=? ORDER BY c.created_at, c.id""", (task_id,))
    return t


@endpoint()
def list_tasks(request, db, user):
    qp = request.query_params
    sql, params = TASK_SELECT + " WHERE t.deleted_at IS NULL", []
    if user["role"] == MEMBER:
        sql += (" AND (t.assignee_id=? OR t.project_id IN (SELECT project_id FROM project_members WHERE user_id=?))")
        params += [user["id"]] * 2
    if qp.get("mine") in ("1", "true"):
        sql += " AND t.assignee_id=?"; params.append(user["id"])
    for key, col in (("project_id", "t.project_id"), ("assignee_id", "t.assignee_id"), ("status", "t.status"),
                     ("priority", "t.priority")):
        if qp.get(key):
            sql += f" AND {col}=?"; params.append(qp[key])
    if qp.get("overdue") in ("1", "true"):
        sql += " AND t.status!='Done' AND t.due_date IS NOT NULL AND t.due_date < ?"; params.append(today().isoformat())
    if qp.get("search"):
        sql += " AND (t.title LIKE ? OR t.description LIKE ?)"; params += [f"%{qp['search']}%"] * 2
    sort = {"due": "t.due_date IS NULL, t.due_date, t.id", "priority": "CASE t.priority WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 "
            "WHEN 'Medium' THEN 2 ELSE 3 END, t.due_date IS NULL, t.due_date", "recent": "t.updated_at DESC"}
    sql += " ORDER BY " + sort.get(qp.get("sort", "board"), "t.position, t.id")
    return [decorate_task(t) for t in q(db, sql, params)]


@endpoint()
def get_task_ep(request, db, user):
    t = _full(db, pid(request), user)
    _task_access(db, user, t)
    return t


@endpoint(roles=[ADMIN, PM], model=TaskIn)
def create_task(request, db, user, d: TaskIn):
    proj = get_project_row(db, d.project_id)
    require_manage(user, proj)
    check_user_exists(db, d.assignee_id, "assignee_id")
    now = now_iso()
    pos = raw1(db, "SELECT COALESCE(MAX(position),-1)+1 AS p FROM tasks WHERE project_id=? AND status=?", (d.project_id, d.status))["p"]
    cur = db.execute(
        """INSERT INTO tasks (project_id,title,description,assignee_id,reporter_id,status,priority,due_date,
           estimated_hours,labels,position,created_at,updated_at,completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (d.project_id, d.title, d.description, d.assignee_id, user["id"], d.status, d.priority, d.due_date,
         d.estimated_hours, jdump(d.labels), pos, now, now, now if d.status == "Done" else None))
    if d.assignee_id:
        db.execute("INSERT OR IGNORE INTO project_members VALUES (?,?,?)", (d.project_id, d.assignee_id, "Contributor"))
    log(db, user["id"], "task", cur.lastrowid, d.project_id, "created_task", d.title)
    return _full(db, cur.lastrowid, user), 201


@endpoint(model=TaskUpdate)
def update_task(request, db, user, d: TaskUpdate):
    t = get_task(db, pid(request))
    proj, manage, assignee = _task_access(db, user, t)
    ch = d.model_dump(exclude_unset=True)
    if not manage:
        if not assignee:
            raise ApiError(403, "forbidden", "You can only update tasks assigned to you")
        if set(ch) - {"status", "description"}:
            raise ApiError(403, "forbidden", "Team members can only change status and notes on their own tasks")
    if "assignee_id" in ch:
        check_user_exists(db, ch["assignee_id"], "assignee_id")
        if ch["assignee_id"]:
            db.execute("INSERT OR IGNORE INTO project_members VALUES (?,?,?)", (t["project_id"], ch["assignee_id"], "Contributor"))
    now = now_iso()
    if "status" in ch and ch["status"] != t["status"]:
        ch["completed_at"] = now if ch["status"] == "Done" else None
    if "labels" in ch:
        ch["labels"] = jdump(ch["labels"])
    if ch:
        db.execute(f"UPDATE tasks SET {', '.join(k + '=?' for k in ch)}, updated_at=? WHERE id=?",
                   list(ch.values()) + [now, t["id"]])
        if "status" in ch and ch["status"] != t["status"]:
            log(db, user["id"], "task", t["id"], t["project_id"], "status_changed", f"{t['title']}: {t['status']} → {ch['status']}")
        elif "assignee_id" in ch:
            nm = raw1(db, "SELECT name FROM users WHERE id=?", (ch["assignee_id"],)) if ch["assignee_id"] else None
            log(db, user["id"], "task", t["id"], t["project_id"], "assigned", f"{t['title']} → {nm['name'] if nm else 'Unassigned'}")
        else:
            log(db, user["id"], "task", t["id"], t["project_id"], "updated_task", t["title"])
    return _full(db, t["id"], user)


@endpoint(model=TaskMove)
def move_task(request, db, user, d: TaskMove):
    t = get_task(db, pid(request))
    proj, manage, assignee = _task_access(db, user, t)
    if not (manage or assignee):
        raise ApiError(403, "forbidden", "You can only move tasks assigned to you")
    now, old = now_iso(), t["status"]
    if old != d.status:
        db.execute("UPDATE tasks SET status=?, completed_at=?, updated_at=? WHERE id=?",
                   (d.status, now if d.status == "Done" else None, now, t["id"]))
        log(db, user["id"], "task", t["id"], t["project_id"], "status_changed", f"{t['title']}: {old} → {d.status}")
    ids = [r["id"] for r in db.execute(
        "SELECT id FROM tasks WHERE project_id=? AND status=? AND deleted_at IS NULL AND id!=? ORDER BY position, id",
        (t["project_id"], d.status, t["id"]))]
    idx = len(ids) if d.position is None else min(d.position, len(ids))
    ids.insert(idx, t["id"])
    for i, tid in enumerate(ids):
        db.execute("UPDATE tasks SET position=? WHERE id=?", (i, tid))
    return get_task(db, t["id"])


@endpoint()
def delete_task(request, db, user):
    t = get_task(db, pid(request))
    proj = get_project_row(db, t["project_id"])
    require_manage(user, proj)
    db.execute("UPDATE tasks SET deleted_at=?, updated_at=? WHERE id=?", (now_iso(), now_iso(), t["id"]))
    log(db, user["id"], "task", t["id"], t["project_id"], "deleted_task", t["title"])
    return {"ok": True}


@endpoint(model=CommentIn)
def add_task_comment(request, db, user, d: CommentIn):
    t = get_task(db, pid(request))
    _task_access(db, user, t)
    cur = db.execute("INSERT INTO task_comments (task_id,author_id,body,created_at) VALUES (?,?,?,?)",
                     (t["id"], user["id"], d.body.strip(), now_iso()))
    log(db, user["id"], "task", t["id"], t["project_id"], "commented", t["title"])
    return q1(db, """SELECT c.*, u.name AS author_name, u.avatar_color AS author_color FROM task_comments c
                     JOIN users u ON u.id=c.author_id WHERE c.id=?""", (cur.lastrowid,)), 201


@endpoint(model=SubtaskIn)
def add_subtask(request, db, user, d: SubtaskIn):
    t = get_task(db, pid(request))
    _, manage, assignee = _task_access(db, user, t)
    if not (manage or assignee):
        raise ApiError(403, "forbidden", "Only the assignee or project manager can edit the checklist")
    cur = db.execute("INSERT INTO subtasks (task_id,title) VALUES (?,?)", (t["id"], d.title.strip()))
    return bool_done(q1(db, "SELECT * FROM subtasks WHERE id=?", (cur.lastrowid,))), 201


def _subtask(db, user, sid):
    s = raw1(db, "SELECT * FROM subtasks WHERE id=?", (sid,))
    if not s:
        raise ApiError(404, "not_found", "Checklist item not found")
    t = get_task(db, s["task_id"])
    _, manage, assignee = _task_access(db, user, t)
    if not (manage or assignee):
        raise ApiError(403, "forbidden", "Only the assignee or project manager can edit the checklist")
    return s, t


@endpoint(model=SubtaskUpdate)
def update_subtask(request, db, user, d: SubtaskUpdate):
    s, t = _subtask(db, user, pid(request))
    ch = d.model_dump(exclude_unset=True)
    if "done" in ch:
        ch["done"] = 1 if ch["done"] else 0
    if ch:
        db.execute(f"UPDATE subtasks SET {', '.join(k + '=?' for k in ch)} WHERE id=?", list(ch.values()) + [s["id"]])
    return bool_done(q1(db, "SELECT * FROM subtasks WHERE id=?", (s["id"],)))


@endpoint()
def delete_subtask(request, db, user):
    s, _ = _subtask(db, user, pid(request))
    db.execute("DELETE FROM subtasks WHERE id=?", (s["id"],))
    return {"ok": True}


routes = [
    Route("/tasks", list_tasks, methods=["GET"]),
    Route("/tasks", create_task, methods=["POST"]),
    Route("/tasks/{id}", get_task_ep, methods=["GET"]),
    Route("/tasks/{id}", update_task, methods=["PATCH"]),
    Route("/tasks/{id}", delete_task, methods=["DELETE"]),
    Route("/tasks/{id}/move", move_task, methods=["PATCH"]),
    Route("/tasks/{id}/comments", add_task_comment, methods=["POST"]),
    Route("/tasks/{id}/subtasks", add_subtask, methods=["POST"]),
    Route("/subtasks/{id}", update_subtask, methods=["PATCH"]),
    Route("/subtasks/{id}", delete_subtask, methods=["DELETE"]),
]
