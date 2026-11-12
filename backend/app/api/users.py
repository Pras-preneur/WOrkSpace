from starlette.routing import Route

from ..core import security
from ..core.http import ApiError, endpoint, now_iso, pid, today
from ..db.database import q, q1, raw1
from ..schemas import UserCreate, UserUpdate
from ..services.common import ADMIN, PM, jdump, log, decorate_task, TASK_SELECT

PUBLIC_COLS = ("id,email,name,role,title,primary_responsibility,responsibilities,skills,phone,bio,"
               "avatar_color,joined_at,active,created_at")


def _with_counts(db, u):
    c = raw1(db, """SELECT COUNT(*) AS assigned,
               SUM(CASE WHEN status!='Done' THEN 1 ELSE 0 END) AS open,
               SUM(CASE WHEN status='Done' THEN 1 ELSE 0 END) AS done,
               SUM(CASE WHEN status!='Done' AND due_date IS NOT NULL AND due_date < ? THEN 1 ELSE 0 END) AS overdue
               FROM tasks WHERE assignee_id=? AND deleted_at IS NULL""", (today().isoformat(), u["id"]))
    u["stats"] = {k: (v or 0) for k, v in c.items()}
    return u


@endpoint()
def list_users(request, db, user):
    qp = request.query_params
    sql, params = f"SELECT {PUBLIC_COLS} FROM users WHERE 1=1", []
    if qp.get("status") == "inactive":
        sql += " AND active=0"
    elif qp.get("status") != "all":
        sql += " AND active=1"
    if qp.get("role"):
        sql += " AND role=?"; params.append(qp["role"])
    if qp.get("search"):
        sql += " AND (name LIKE ? OR email LIKE ? OR title LIKE ? OR skills LIKE ? OR responsibilities LIKE ?)"
        params += [f"%{qp['search']}%"] * 5
    if qp.get("skill"):
        sql += " AND skills LIKE ?"; params.append(f'%"{qp["skill"]}"%')
    sql += " ORDER BY CASE role WHEN 'Admin' THEN 0 WHEN 'Project Manager' THEN 1 ELSE 2 END, name"
    return [_with_counts(db, u) for u in q(db, sql, params)]


@endpoint()
def get_user(request, db, user):
    u = q1(db, f"SELECT {PUBLIC_COLS} FROM users WHERE id=?", (pid(request),))
    if not u:
        raise ApiError(404, "not_found", "User not found")
    _with_counts(db, u)
    u["projects"] = q(db, """SELECT DISTINCT p.id,p.name,p.status FROM projects p
        LEFT JOIN project_members m ON m.project_id=p.id
        WHERE p.deleted_at IS NULL AND (m.user_id=? OR p.manager_id=?) ORDER BY p.name""", (u["id"], u["id"]))
    tasks = q(db, TASK_SELECT + " WHERE t.assignee_id=? AND t.deleted_at IS NULL AND t.status!='Done' "
              "ORDER BY t.due_date IS NULL, t.due_date LIMIT 8", (u["id"],))
    u["open_tasks"] = [decorate_task(t) for t in tasks]
    return u


@endpoint(roles=[ADMIN], model=UserCreate)
def create_user(request, db, user, d: UserCreate):
    if raw1(db, "SELECT 1 AS x FROM users WHERE lower(email)=lower(?)", (d.email,)):
        raise ApiError(409, "duplicate", "A user with this email already exists")
    now = now_iso()
    cur = db.execute(
        """INSERT INTO users (email,name,password_hash,role,title,primary_responsibility,responsibilities,skills,
           phone,bio,avatar_color,joined_at,must_change_password,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (d.email, d.name, security.hash_password(d.password), d.role, d.title, d.primary_responsibility,
         jdump(d.responsibilities), jdump(d.skills), d.phone, d.bio, d.avatar_color, today().isoformat(), 1, now, now))
    log(db, user["id"], "user", cur.lastrowid, None, "created_user", d.name)
    return q1(db, f"SELECT {PUBLIC_COLS} FROM users WHERE id=?", (cur.lastrowid,)), 201


@endpoint(model=UserUpdate)
def update_user(request, db, user, d: UserUpdate):
    uid = pid(request)
    target = raw1(db, "SELECT * FROM users WHERE id=?", (uid,))
    if not target:
        raise ApiError(404, "not_found", "User not found")
    is_admin = user["role"] == ADMIN
    changes = d.model_dump(exclude_unset=True)
    if not is_admin:
        if uid != user["id"]:
            raise ApiError(403, "forbidden", "You can only edit your own profile")
        allowed = {"name", "phone", "bio", "skills", "avatar_color", "title"}
        if set(changes) - allowed:
            raise ApiError(403, "forbidden", "You can only edit basic profile fields")
    if uid == user["id"] and (changes.get("active") is False or ("role" in changes and changes["role"] != user["role"])):
        raise ApiError(400, "invalid", "You cannot deactivate yourself or change your own role")
    sets, params = [], []
    for k, v in changes.items():
        if k == "password":
            sets.append("password_hash=?"); params.append(security.hash_password(v)); sets.append("must_change_password=1")
            continue
        if k in ("skills", "responsibilities"):
            v = jdump(v)
        if k == "active":
            v = 1 if v else 0
        sets.append(f"{k}=?"); params.append(v)
    if sets:
        sets.append("updated_at=?"); params.append(now_iso())
        db.execute(f"UPDATE users SET {', '.join(sets)} WHERE id=?", params + [uid])
        log(db, user["id"], "user", uid, None, "updated_user", target["name"])
    return q1(db, f"SELECT {PUBLIC_COLS} FROM users WHERE id=?", (uid,))


@endpoint(roles=[ADMIN])
def deactivate_user(request, db, user):
    uid = pid(request)
    if uid == user["id"]:
        raise ApiError(400, "invalid", "You cannot deactivate yourself")
    t = raw1(db, "SELECT name FROM users WHERE id=?", (uid,))
    if not t:
        raise ApiError(404, "not_found", "User not found")
    db.execute("UPDATE users SET active=0, updated_at=? WHERE id=?", (now_iso(), uid))
    log(db, user["id"], "user", uid, None, "deactivated_user", t["name"])
    return {"ok": True}


routes = [
    Route("/users", list_users, methods=["GET"]),
    Route("/users", create_user, methods=["POST"]),
    Route("/users/{id}", get_user, methods=["GET"]),
    Route("/users/{id}", update_user, methods=["PATCH"]),
    Route("/users/{id}", deactivate_user, methods=["DELETE"]),
]
