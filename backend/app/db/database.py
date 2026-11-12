"""SQLite data layer (demo). Schema mirrors the intended PostgreSQL model."""
import json
import os
import sqlite3
from contextlib import contextmanager

from ..core import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin','Project Manager','Team Member','Client')),
  title TEXT DEFAULT '',
  primary_responsibility TEXT DEFAULT '',
  responsibilities TEXT DEFAULT '[]',
  skills TEXT DEFAULT '[]',
  phone TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  avatar_color TEXT DEFAULT '#6366f1',
  joined_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT DEFAULT '',
  contact_person TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Lead','Active','Inactive')),
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  client_id INTEGER REFERENCES clients(id),
  manager_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'Planning' CHECK (status IN ('Planning','Active','On Hold','Completed','Cancelled')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High','Urgent')),
  start_date TEXT,
  deadline TEXT,
  budget REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (deadline IS NULL OR start_date IS NULL OR deadline >= start_date)
);
CREATE TABLE IF NOT EXISTS project_members (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  project_role TEXT DEFAULT 'Contributor',
  PRIMARY KEY (project_id, user_id)
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  assignee_id INTEGER REFERENCES users(id),
  reporter_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'To Do' CHECK (status IN ('To Do','In Progress','In Review','Done','Blocked')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High','Urgent')),
  due_date TEXT,
  estimated_hours REAL,
  labels TEXT DEFAULT '[]',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS task_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'comment',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER REFERENCES users(id),
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  project_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
-- Phase 4 placeholders (schema only; not used by the MVP API yet)
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL, body TEXT DEFAULT '', read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, task_id INTEGER, uploader_id INTEGER,
  filename TEXT, storage_key TEXT, size_bytes INTEGER, created_at TEXT
);
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, day TEXT, check_in TEXT, check_out TEXT, note TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_logs(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pm_user ON project_members(user_id);
"""

JSON_COLUMNS = {"skills", "responsibilities", "labels"}


def connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(os.path.abspath(config.DB_PATH)), exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as db:
        db.executescript(SCHEMA)


def _clean(d: dict) -> dict:
    for k in JSON_COLUMNS:
        if k in d and isinstance(d[k], str):
            try:
                d[k] = json.loads(d[k] or "[]")
            except ValueError:
                d[k] = []
    d.pop("password_hash", None)
    for k in ("active", "must_change_password"):
        if k in d and d[k] is not None:
            d[k] = bool(d[k])
    return d


def bool_done(row):
    """Subtask rows only: cast the 0/1 `done` column to a bool (aggregates also use a `done` alias)."""
    if row is not None:
        row["done"] = bool(row["done"])
    return row


def q(db, sql, params=()):
    return [_clean(dict(r)) for r in db.execute(sql, params).fetchall()]


def q1(db, sql, params=()):
    r = db.execute(sql, params).fetchone()
    return _clean(dict(r)) if r else None


def raw1(db, sql, params=()):
    r = db.execute(sql, params).fetchone()
    return dict(r) if r else None
