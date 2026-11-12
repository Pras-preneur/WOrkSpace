from datetime import date, timedelta

from app.core import security
from tests.conftest import login

A = "/api/v1"


# ---------------- auth ----------------
def test_health_and_meta(client):
    assert client.get(f"{A}/health").json()["status"] == "ok"
    assert "Done" in client.get(f"{A}/meta").json()["task_statuses"]


def test_login_success_and_me(client, dev):
    me = client.get(f"{A}/auth/me", headers=dev).json()
    assert me["email"] == "sarvadnya@origintheory.io" and "password_hash" not in me
    assert me["primary_responsibility"].startswith("Web Development")


def test_login_failure_and_throttle(client):
    security.throttle._fails.clear()
    for _ in range(5):
        r = client.post(f"{A}/auth/login", json={"email": "pm@origintheory.io", "password": "nope"})
        assert r.status_code == 401
    r = client.post(f"{A}/auth/login", json={"email": "pm@origintheory.io", "password": "nope"})
    assert r.status_code == 429
    security.throttle._fails.clear()


def test_auth_required_and_bad_token(client):
    assert client.get(f"{A}/projects").status_code == 401
    assert client.get(f"{A}/projects", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_refresh_token_flow(client):
    security.throttle._fails.clear()
    r = client.post(f"{A}/auth/login", json={"email": "pm@origintheory.io", "password": "Welcome@123"}).json()
    # an access token must not work as a refresh token
    assert client.post(f"{A}/auth/refresh", json={"refresh_token": r["access_token"]}).status_code == 401
    new = client.post(f"{A}/auth/refresh", json={"refresh_token": r["refresh_token"]})
    assert new.status_code == 200
    # a refresh token must not work as an access token
    assert client.get(f"{A}/auth/me", headers={"Authorization": f"Bearer {r['refresh_token']}"}).status_code == 401


# ---------------- RBAC ----------------
def test_member_cannot_create_user_project_or_client(client, dev):
    assert client.post(f"{A}/users", headers=dev, json={"name": "X Y", "email": "x@y.io", "password": "Password123"}).status_code == 403
    assert client.post(f"{A}/projects", headers=dev, json={"name": "Hack"}).status_code == 403
    assert client.get(f"{A}/clients", headers=dev).status_code == 403
    assert client.get(f"{A}/analytics/team", headers=dev).status_code == 403


def test_admin_creates_and_deactivates_user(client, admin):
    r = client.post(f"{A}/users", headers=admin, json={
        "name": "New Hire", "email": "new.hire@origintheory.io", "password": "TempPass123", "role": "Team Member",
        "skills": ["Figma"], "responsibilities": ["UI Design"]})
    assert r.status_code == 201 and r.json()["skills"] == ["Figma"]
    uid = r.json()["id"]
    assert client.post(f"{A}/users", headers=admin, json={"name": "Dup", "email": "NEW.hire@origintheory.io", "password": "TempPass123"}).status_code == 409
    assert client.delete(f"{A}/users/{uid}", headers=admin).status_code == 200
    names = [u["name"] for u in client.get(f"{A}/users", headers=admin).json()]
    assert "New Hire" not in names
    # deactivated user cannot log in
    assert client.post(f"{A}/auth/login", json={"email": "new.hire@origintheory.io", "password": "TempPass123"}).status_code == 401


def test_validation_errors_have_field_details(client, admin):
    r = client.post(f"{A}/projects", headers=admin, json={"name": "A", "start_date": "2026-05-10", "deadline": "2026-05-01"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"
    assert r.json()["error"]["details"]


def test_member_cannot_edit_others_tasks(client, dev):
    tasks = client.get(f"{A}/tasks?assignee_id=4", headers=dev).json()  # manmohan's tasks
    mine = [t for t in client.get(f"{A}/tasks", headers=dev).json() if t["assignee_name"] == "Manmohan Havanur"]
    assert mine
    r = client.patch(f"{A}/tasks/{mine[0]['id']}", headers=dev, json={"status": "Done"})
    assert r.status_code == 403


def test_member_limited_fields_on_own_task(client, dev):
    mine = client.get(f"{A}/tasks?mine=1&status=To Do", headers=dev).json()[0]
    assert client.patch(f"{A}/tasks/{mine['id']}", headers=dev, json={"priority": "Low"}).status_code == 403
    assert client.patch(f"{A}/tasks/{mine['id']}", headers=dev, json={"assignee_id": 4}).status_code == 403
    assert client.patch(f"{A}/tasks/{mine['id']}", headers=dev, json={"description": "note"}).status_code == 200


def test_pm_cannot_manage_other_pms_project(client, admin, pm):
    # admin creates a second PM and a project owned by them
    r = client.post(f"{A}/users", headers=admin, json={"name": "Other PM", "email": "other.pm@origintheory.io",
                                                       "password": "TempPass123", "role": "Project Manager"})
    other = r.json()["id"]
    p = client.post(f"{A}/projects", headers=admin, json={"name": "Other PM Project", "manager_id": other}).json()
    assert p["manager_id"] == other
    assert client.patch(f"{A}/projects/{p['id']}", headers=pm, json={"status": "Active"}).status_code == 403
    assert client.post(f"{A}/tasks", headers=pm, json={"project_id": p["id"], "title": "Sneaky task"}).status_code == 403


def test_member_sees_only_their_projects(client, admin):
    p = client.post(f"{A}/projects", headers=admin, json={"name": "Secret Admin Project"}).json()
    sec = login(client, "manmohan@origintheory.io")
    names = [x["name"] for x in client.get(f"{A}/projects", headers=sec).json()]
    assert "Secret Admin Project" not in names
    assert client.get(f"{A}/projects/{p['id']}", headers=sec).status_code == 403


# ---------------- projects & tasks ----------------
def test_project_lifecycle_and_progress(client, pm):
    clients_ = client.get(f"{A}/clients", headers=pm).json()
    p = client.post(f"{A}/projects", headers=pm, json={
        "name": "Test Project", "client_id": clients_[0]["id"], "status": "Active", "priority": "High",
        "start_date": date.today().isoformat(), "deadline": (date.today() + timedelta(days=10)).isoformat(),
        "member_ids": [3]}).json()
    assert p["progress"] == 0 and p["manager_id"] == 2
    t1 = client.post(f"{A}/tasks", headers=pm, json={"project_id": p["id"], "title": "Task one", "assignee_id": 3}).json()
    t2 = client.post(f"{A}/tasks", headers=pm, json={"project_id": p["id"], "title": "Task two", "assignee_id": 3}).json()
    client.patch(f"{A}/tasks/{t1['id']}/move", headers=pm, json={"status": "Done"})
    p2 = client.get(f"{A}/projects/{p['id']}", headers=pm).json()
    assert p2["progress"] == 50 and p2["task_total"] == 2 and p2["can_manage"] is True
    done = client.get(f"{A}/tasks/{t1['id']}", headers=pm).json()
    assert done["completed_at"] is not None
    client.patch(f"{A}/tasks/{t1['id']}/move", headers=pm, json={"status": "In Progress"})
    assert client.get(f"{A}/tasks/{t1['id']}", headers=pm).json()["completed_at"] is None
    # activity log recorded
    acts = client.get(f"{A}/projects/{p['id']}/activity", headers=pm).json()
    assert {"created_project", "created_task", "status_changed"} <= {a["action"] for a in acts}


def test_overdue_and_due_soon_flags(client, pm):
    y = (date.today() - timedelta(days=2)).isoformat()
    s = (date.today() + timedelta(days=1)).isoformat()
    pr = client.get(f"{A}/projects", headers=pm).json()[0]
    a = client.post(f"{A}/tasks", headers=pm, json={"project_id": pr["id"], "title": "Late task", "due_date": y}).json()
    b = client.post(f"{A}/tasks", headers=pm, json={"project_id": pr["id"], "title": "Soon task", "due_date": s}).json()
    assert a["overdue"] is True and a["due_soon"] is False
    assert b["overdue"] is False and b["due_soon"] is True and b["days_left"] == 1
    client.patch(f"{A}/tasks/{a['id']}/move", headers=pm, json={"status": "Done"})
    assert client.get(f"{A}/tasks/{a['id']}", headers=pm).json()["overdue"] is False
    assert any(t["id"] == b["id"] for t in client.get(f"{A}/tasks?sort=due", headers=pm).json())


def test_kanban_move_reorders_positions(client, pm):
    pr = client.post(f"{A}/projects", headers=pm, json={"name": "Kanban Project"}).json()
    ids = [client.post(f"{A}/tasks", headers=pm, json={"project_id": pr["id"], "title": f"K{i}"}).json()["id"] for i in range(3)]
    client.patch(f"{A}/tasks/{ids[2]}/move", headers=pm, json={"status": "To Do", "position": 0})
    order = [t["id"] for t in client.get(f"{A}/tasks?project_id={pr['id']}&status=To Do", headers=pm).json()]
    assert order == [ids[2], ids[0], ids[1]]


def test_subtasks_and_comments(client, dev):
    mine = client.get(f"{A}/tasks?mine=1&status=In Progress", headers=dev).json()[0]
    s = client.post(f"{A}/tasks/{mine['id']}/subtasks", headers=dev, json={"title": "New check"}).json()
    assert client.patch(f"{A}/subtasks/{s['id']}", headers=dev, json={"done": True}).json()["done"] is True
    c = client.post(f"{A}/tasks/{mine['id']}/comments", headers=dev, json={"body": "Progress update"})
    assert c.status_code == 201 and c.json()["author_name"] == "Sarvadnya Patil"
    full = client.get(f"{A}/tasks/{mine['id']}", headers=dev).json()
    assert any(x["title"] == "New check" and x["done"] for x in full["subtasks"])
    assert full["comment_count"] >= 1


def test_project_discussion(client, dev):
    pr = client.get(f"{A}/projects", headers=dev).json()[0]
    r = client.post(f"{A}/projects/{pr['id']}/comments", headers=dev, json={"body": "Hello team"})
    assert r.status_code == 201
    assert client.get(f"{A}/projects/{pr['id']}/comments", headers=dev).json()[0]["body"] == "Hello team"
    assert client.post(f"{A}/projects/{pr['id']}/comments", headers=dev, json={"body": ""}).status_code == 422


# ---------------- analytics ----------------
def test_dashboard_overview_matches_underlying_data(client, admin):
    ov = client.get(f"{A}/dashboard/overview", headers=admin).json()
    tasks = client.get(f"{A}/tasks", headers=admin).json()
    assert ov["scope"] == "organization"
    assert ov["kpis"]["total_tasks"] == len(tasks)
    assert ov["kpis"]["overdue_tasks"] == sum(1 for t in tasks if t["overdue"])
    assert ov["kpis"]["open_tasks"] == sum(1 for t in tasks if t["status"] != "Done")
    assert sum(x["count"] for x in ov["tasks_by_status"]) == len(tasks)
    assert len(ov["completed_per_week"]) == 8
    assert ov["workload"] and ov["upcoming_deadlines"] is not None


def test_dashboard_member_scope_is_personal(client, dev):
    ov = client.get(f"{A}/dashboard/overview", headers=dev).json()
    mine = client.get(f"{A}/tasks?mine=1", headers=dev).json()
    assert ov["scope"] == "personal" and ov["kpis"]["total_tasks"] == len(mine)


def test_team_performance(client, pm):
    r = client.get(f"{A}/analytics/team?days=90", headers=pm).json()
    names = {m["name"] for m in r["members"]}
    assert {"Sarvadnya Patil", "Manmohan Havanur", "Prasanna Hosmani"} <= names
    for m in r["members"]:
        assert m["assigned"] >= m["open"] + 0
        assert m["on_time_pct"] is None or 0 <= m["on_time_pct"] <= 100


def test_notifications_contain_overdue_for_member(client, dev):
    n = client.get(f"{A}/notifications", headers=dev).json()
    assert n["count"] >= 1 and any(i["kind"] == "overdue" for i in n["items"])


def test_clients_crud(client, pm, admin):
    c = client.post(f"{A}/clients", headers=pm, json={"name": "Zeta Corp", "email": "z@zeta.io"}).json()
    assert client.patch(f"{A}/clients/{c['id']}", headers=pm, json={"status": "Lead"}).json()["status"] == "Lead"
    assert client.delete(f"{A}/clients/{c['id']}", headers=pm).status_code == 403
    assert client.delete(f"{A}/clients/{c['id']}", headers=admin).status_code == 200
    assert client.get(f"{A}/clients/{c['id']}", headers=pm).status_code == 404


def test_unknown_route_json_404(client):
    r = client.get(f"{A}/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_progress_numbers_are_correct_everywhere(client, admin):
    """Regression: aggregate `done` counts must be integers (not cast to bool)."""
    proj = {p["id"]: p for p in client.get(f"{A}/projects", headers=admin).json()}
    for row in client.get(f"{A}/analytics/projects", headers=admin).json():
        p = proj[row["id"]]
        assert isinstance(row["done"], int) and row["done"] == p["task_done"]
        assert row["progress"] == p["progress"]
    ov = client.get(f"{A}/dashboard/overview", headers=admin).json()
    for r in ov["at_risk_projects"]:
        assert r["progress"] == proj[r["id"]]["progress"]
    cl = client.get(f"{A}/clients", headers=admin).json()[0]
    for p in client.get(f"{A}/clients/{cl['id']}", headers=admin).json()["projects"]:
        assert p["progress"] == proj[p["id"]]["progress"]
