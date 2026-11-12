from starlette.routing import Route

from ..core.http import ApiError, endpoint, now_iso, pid
from ..db.database import q, q1
from ..schemas import ClientIn, ClientUpdate
from ..services.common import ADMIN, PM, log

STAFF = [ADMIN, PM]

LIST_SQL = """SELECT c.*,
  (SELECT COUNT(*) FROM projects p WHERE p.client_id=c.id AND p.deleted_at IS NULL) AS project_count,
  (SELECT COUNT(*) FROM projects p WHERE p.client_id=c.id AND p.deleted_at IS NULL AND p.status='Active') AS active_projects
  FROM clients c WHERE c.deleted_at IS NULL"""


@endpoint(roles=STAFF)
def list_clients(request, db, user):
    qp, sql, params = request.query_params, LIST_SQL, []
    if qp.get("status"):
        sql += " AND c.status=?"; params.append(qp["status"])
    if qp.get("search"):
        sql += " AND (c.name LIKE ? OR c.company LIKE ? OR c.contact_person LIKE ?)"; params += [f"%{qp['search']}%"] * 3
    return q(db, sql + " ORDER BY c.name", params)


@endpoint(roles=STAFF)
def get_client(request, db, user):
    c = q1(db, LIST_SQL + " AND c.id=?", (pid(request),))
    if not c:
        raise ApiError(404, "not_found", "Client not found")
    c["projects"] = q(db, """SELECT p.id,p.name,p.status,p.priority,p.deadline,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.deleted_at IS NULL) AS total,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.deleted_at IS NULL AND t.status='Done') AS done
        FROM projects p WHERE p.client_id=? AND p.deleted_at IS NULL ORDER BY p.created_at DESC""", (c["id"],))
    for p in c["projects"]:
        p["progress"] = round(100 * p["done"] / p["total"]) if p["total"] else 0
    return c


@endpoint(roles=STAFF, model=ClientIn)
def create_client(request, db, user, d: ClientIn):
    cur = db.execute("INSERT INTO clients (name,company,contact_person,email,phone,notes,status,created_at)"
                     " VALUES (?,?,?,?,?,?,?,?)",
                     (d.name, d.company, d.contact_person, d.email, d.phone, d.notes, d.status, now_iso()))
    log(db, user["id"], "client", cur.lastrowid, None, "created_client", d.name)
    return q1(db, LIST_SQL + " AND c.id=?", (cur.lastrowid,)), 201


@endpoint(roles=STAFF, model=ClientUpdate)
def update_client(request, db, user, d: ClientUpdate):
    cid = pid(request)
    if not q1(db, "SELECT id FROM clients WHERE id=? AND deleted_at IS NULL", (cid,)):
        raise ApiError(404, "not_found", "Client not found")
    ch = d.model_dump(exclude_unset=True)
    if ch:
        db.execute(f"UPDATE clients SET {', '.join(k + '=?' for k in ch)} WHERE id=?", list(ch.values()) + [cid])
        log(db, user["id"], "client", cid, None, "updated_client", ch.get("name", ""))
    return q1(db, LIST_SQL + " AND c.id=?", (cid,))


@endpoint(roles=[ADMIN])
def delete_client(request, db, user):
    cid = pid(request)
    if not q1(db, "SELECT id FROM clients WHERE id=? AND deleted_at IS NULL", (cid,)):
        raise ApiError(404, "not_found", "Client not found")
    db.execute("UPDATE clients SET deleted_at=?, status='Inactive' WHERE id=?", (now_iso(), cid))
    log(db, user["id"], "client", cid, None, "archived_client")
    return {"ok": True}


routes = [
    Route("/clients", list_clients, methods=["GET"]),
    Route("/clients", create_client, methods=["POST"]),
    Route("/clients/{id}", get_client, methods=["GET"]),
    Route("/clients/{id}", update_client, methods=["PATCH"]),
    Route("/clients/{id}", delete_client, methods=["DELETE"]),
]
