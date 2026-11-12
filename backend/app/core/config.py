"""Central configuration. Everything is overridable through environment variables."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]

# --- Database -------------------------------------------------------------
# Demo mode uses a local SQLite file. The data-access layer lives in app/db so
# it can be swapped for SQLAlchemy + PostgreSQL later without touching the API.
DB_PATH = os.getenv("OT_DB_PATH", str(BASE_DIR / "data" / "origintheory.db"))

# --- Auth -----------------------------------------------------------------
SECRET_KEY = os.getenv("OT_SECRET_KEY", "dev-only-secret-change-me-in-production-0123456789")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = int(os.getenv("OT_ACCESS_MIN", "30"))
REFRESH_TOKEN_DAYS = int(os.getenv("OT_REFRESH_DAYS", "7"))
PASSWORD_ITERATIONS = int(os.getenv("OT_PW_ITERATIONS", "200000"))
LOGIN_MAX_FAILURES = 5          # failed attempts ...
LOGIN_WINDOW_SECONDS = 300      # ... within this window => HTTP 429

# --- Web ------------------------------------------------------------------
CORS_ORIGINS = [o.strip() for o in os.getenv(
    "OT_CORS_ORIGINS", "http://localhost:5173,http://localhost:8000,http://127.0.0.1:8000").split(",")]
STATIC_DIR = os.getenv("OT_STATIC_DIR", str(BASE_DIR.parent / "frontend" / "dist"))

# --- Domain constants -----------------------------------------------------
ROLES = ("Admin", "Project Manager", "Team Member", "Client")
PROJECT_STATUSES = ("Planning", "Active", "On Hold", "Completed", "Cancelled")
TASK_STATUSES = ("To Do", "In Progress", "In Review", "Done", "Blocked")
PRIORITIES = ("Low", "Medium", "High", "Urgent")
CLIENT_STATUSES = ("Lead", "Active", "Inactive")
DUE_SOON_DAYS = 3
