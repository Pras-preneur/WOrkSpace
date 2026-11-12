"""Password hashing + JWT helpers (stdlib PBKDF2 + PyJWT)."""
import base64
import hashlib
import hmac
import os
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import jwt

from . import config


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, config.PASSWORD_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        config.PASSWORD_ITERATIONS, base64.b64encode(salt).decode(), base64.b64encode(digest).decode())


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iters, salt, digest = stored.split("$")
        calc = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt), int(iters))
        return hmac.compare_digest(calc, base64.b64decode(digest))
    except Exception:
        return False


def _make_token(user_id: int, kind: str, delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "type": kind, "iat": now, "exp": now + delta}
    return jwt.encode(payload, config.SECRET_KEY, algorithm=config.JWT_ALGORITHM)


def create_access_token(user_id: int) -> str:
    return _make_token(user_id, "access", timedelta(minutes=config.ACCESS_TOKEN_MINUTES))


def create_refresh_token(user_id: int) -> str:
    return _make_token(user_id, "refresh", timedelta(days=config.REFRESH_TOKEN_DAYS))


def decode_token(token: str, expected: str) -> int | None:
    try:
        data = jwt.decode(token, config.SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    if data.get("type") != expected:
        return None
    return int(data["sub"])


class LoginThrottle:
    """Tiny in-memory sliding-window limiter for failed logins (swap for Redis in prod)."""

    def __init__(self):
        self._fails: dict[str, deque] = defaultdict(deque)

    def _prune(self, key):
        q, cutoff = self._fails[key], time.time() - config.LOGIN_WINDOW_SECONDS
        while q and q[0] < cutoff:
            q.popleft()

    def blocked(self, key: str) -> bool:
        self._prune(key)
        return len(self._fails[key]) >= config.LOGIN_MAX_FAILURES

    def fail(self, key: str):
        self._fails[key].append(time.time())

    def reset(self, key: str):
        self._fails.pop(key, None)


throttle = LoginThrottle()
