from starlette.routing import Route

from ..core import security
from ..core.http import ApiError, endpoint, now_iso
from ..db.database import q1, raw1
from ..schemas import ChangePasswordIn, LoginIn, RefreshIn
from ..services.common import log


def _public(db, uid):
    return q1(db, "SELECT * FROM users WHERE id=?", (uid,))


@endpoint(public=True, model=LoginIn)
def login(request, db, _user, data: LoginIn):
    key = f"{data.email.lower()}|{request.client.host if request.client else '-'}"
    if security.throttle.blocked(key):
        raise ApiError(429, "too_many_attempts", "Too many failed logins. Try again in a few minutes.")
    row = raw1(db, "SELECT * FROM users WHERE lower(email)=lower(?)", (data.email,))
    if not row or not security.verify_password(data.password, row["password_hash"]) or not row["active"]:
        security.throttle.fail(key)
        raise ApiError(401, "invalid_credentials", "Incorrect email or password")
    security.throttle.reset(key)
    log(db, row["id"], "user", row["id"], None, "logged_in")
    return {
        "access_token": security.create_access_token(row["id"]),
        "refresh_token": security.create_refresh_token(row["id"]),
        "token_type": "bearer",
        "user": _public(db, row["id"]),
    }


@endpoint(public=True, model=RefreshIn)
def refresh(request, db, _user, data: RefreshIn):
    uid = security.decode_token(data.refresh_token, "refresh")
    row = raw1(db, "SELECT id FROM users WHERE id=? AND active=1", (uid,)) if uid else None
    if not row:
        raise ApiError(401, "invalid_token", "Refresh token is invalid or expired")
    return {"access_token": security.create_access_token(uid), "refresh_token": security.create_refresh_token(uid),
            "token_type": "bearer"}


@endpoint()
def me(request, db, user):
    return _public(db, user["id"])


@endpoint(model=ChangePasswordIn)
def change_password(request, db, user, data: ChangePasswordIn):
    if not security.verify_password(data.current_password, user["password_hash"]):
        raise ApiError(400, "wrong_password", "Current password is incorrect")
    db.execute("UPDATE users SET password_hash=?, must_change_password=0, updated_at=? WHERE id=?",
               (security.hash_password(data.new_password), now_iso(), user["id"]))
    return {"ok": True}


routes = [
    Route("/auth/login", login, methods=["POST"]),
    Route("/auth/refresh", refresh, methods=["POST"]),
    Route("/auth/me", me, methods=["GET"]),
    Route("/auth/change-password", change_password, methods=["POST"]),
]
