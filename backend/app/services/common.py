"""Shared domain helpers: activity log, serializers, permission checks."""
import json
from ..core import config
from ..core.http import ApiError, now_iso, today
from ..db.database import q, q1, raw1

ADMIN, PM, MEMBER = "Admin", "Project Manager", "Team Member"


def log(db, actor_id, entity_type, entity_id, project_id, action, detail=""):
    db.execute(
        "INSERT INTO activity_logs (actor_id, entity_type, entity_id, project_id, action, detail, created_at)"
        " VALUES (?,?,?,?,?,?,?)",
        (actor_id, entity_type, entity_id, project_id, action, detail, now_iso()))


def deadline_flags(due_date: str | None, status: str):
    """Return (overdue, due_soon, days_left) for a date string."""
    if not due_date:
        return False, False, None
    days_left = (__import__("datetime").date.fromisoformat(due_date) - today()).days
    open_ = status not in ("Done", "Completed", "Cancelled")
    return (open_ and days_left < 0), (open_ and 0 <= days_left <= config.DUE_SOON_DAYS), days_left


TASK_SELECT = """
SELECT t.*, p.name AS project_name, a.name AS assignee_name, a.avatar_color AS assignee_color,
       r.name AS reporter_name,
       (SELECT COUNT(*) FROM subtasks s WHERE s.task_id=t.id) AS subtask_total,
       (SELECT COUNT(*) FROM subtasks s WHERE s.task_id=t.id AND s.done=1) AS subtask_done,
       (SELECT COUNT(*) FROM task_comments c WHERE c.task_id=t.id) AS comment_count
FROM tasks t
JOIN projects p ON p.id=t.project_id AND p.deleted_at IS NULL
LEFT JOIN users a ON a.id=t.assignee_id
LEFT JOIN users r ON r.id=t.reporter_id
"""


def decorate_task(t: dict) -> dict:
    t["overdue"], t["due_soon"], t["days_left"] = deadline_flags(t.get("due_date"), t["status"])
    return t


def get_task(db, task_id):
    t = q1(db, TASK_SELECT + " WHERE t.id=? AND t.deleted_at IS NULL", (task_id,))
    if not t:
        raise ApiError(404, "not_found", "Task not found")
    return decorate_task(t)


def get_project_row(db, project_id):
    p = raw1(db, "SELECT * FROM projects WHERE id=? AND deleted_at IS NULL", (project_id,))
    if not p:
        raise ApiError(404, "not_found", "Project not found")
    return p


def is_member(db, project_id, user_id) -> bool:
    return bool(raw1(db, "SELECT 1 AS x FROM project_members WHERE project_id=? AND user_id=?", (project_id, user_id))
                or raw1(db, "SELECT 1 AS x FROM tasks WHERE project_id=? AND assignee_id=? AND deleted_at IS NULL",
                        (project_id, user_id)))


def can_manage_project(user, project) -> bool:
    return user["role"] == ADMIN or (user["role"] == PM and project["manager_id"] == user["id"])


def can_view_project(db, user, project) -> bool:
    return user["role"] in (ADMIN, PM) or is_member(db, project["id"], user["id"])


def require_view(db, user, project):
    if not can_view_project(db, user, project):
        raise ApiError(403, "forbidden", "You are not a member of this project")


def require_manage(user, project):
    if not can_manage_project(user, project):
        raise ApiError(403, "forbidden", "Only the project manager or an admin can do this")


def check_user_exists(db, user_id, field="user_id"):
    if user_id is not None and not raw1(db, "SELECT 1 AS x FROM users WHERE id=? AND active=1", (user_id,)):
        raise ApiError(422, "validation_error", "Validation failed", [{"field": field, "message": "User not found"}])


def check_client_exists(db, client_id):
    if client_id is not None and not raw1(db, "SELECT 1 AS x FROM clients WHERE id=? AND deleted_at IS NULL", (client_id,)):
        raise ApiError(422, "validation_error", "Validation failed", [{"field": "client_id", "message": "Client not found"}])


def jdump(v) -> str:
    return json.dumps(v)
