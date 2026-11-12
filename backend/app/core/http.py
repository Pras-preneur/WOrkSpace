"""Tiny framework layer on top of Starlette: auth, RBAC, validation, error envelope."""
import inspect
from datetime import datetime, timezone, date

from pydantic import BaseModel, ValidationError
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from . import security
from ..db.database import get_db, raw1


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, details=None):
        self.status, self.code, self.message, self.details = status, code, message, details


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


def today() -> date:
    return datetime.now(timezone.utc).date()


def authenticate(request: Request, db):
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise ApiError(401, "unauthenticated", "Missing bearer token")
    uid = security.decode_token(header[7:].strip(), "access")
    if uid is None:
        raise ApiError(401, "invalid_token", "Token is invalid or expired")
    user = raw1(db, "SELECT * FROM users WHERE id=? AND active=1", (uid,))
    if not user:
        raise ApiError(401, "unauthenticated", "User not found or deactivated")
    return user


def endpoint(roles=None, public=False, model: type[BaseModel] | None = None):
    """Decorate a handler `fn(request, db, user[, data])`. Handlers return data or (data, status)."""

    def deco(fn):
        async def wrapper(request: Request):
            try:
                with get_db() as db:
                    user = None if public else authenticate(request, db)
                    if roles and user["role"] not in roles:
                        raise ApiError(403, "forbidden", "You do not have permission to perform this action")
                    args = [request, db, user]
                    if model is not None:
                        try:
                            payload = await request.json()
                        except Exception:
                            raise ApiError(400, "bad_json", "Request body must be valid JSON")
                        try:
                            args.append(model.model_validate(payload))
                        except ValidationError as e:
                            details = [{"field": ".".join(map(str, x["loc"])), "message": x["msg"]} for x in e.errors()]
                            raise ApiError(422, "validation_error", "Validation failed", details)
                    result = fn(*args)
                    if inspect.isawaitable(result):
                        result = await result
                    status = 200
                    if isinstance(result, tuple):
                        result, status = result
                    if isinstance(result, Response):
                        return result
                    return JSONResponse(result, status_code=status)
            except ApiError as e:
                return JSONResponse({"error": {"code": e.code, "message": e.message, "details": e.details}},
                                    status_code=e.status)
        wrapper.__name__ = fn.__name__
        return wrapper

    return deco


def pid(request: Request, name="id") -> int:
    try:
        return int(request.path_params[name])
    except (KeyError, ValueError):
        raise ApiError(404, "not_found", "Resource not found")


def paginate(request: Request, default=100, maximum=500):
    try:
        limit = min(int(request.query_params.get("limit", default)), maximum)
        offset = max(int(request.query_params.get("offset", 0)), 0)
    except ValueError:
        raise ApiError(400, "bad_query", "limit/offset must be integers")
    return limit, offset
