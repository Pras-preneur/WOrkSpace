# OriginTheory Workspace

Team & Project Management platform for OriginTheory: the **MVP** (five modules: Auth, Team, Projects, Tasks, Dashboard & Analytics), with a demo database.

## Quick start

**Windows:** double-click `start.bat`  **Mac/Linux:** `./start.sh`
Then open **http://localhost:8000**.

The frontend is pre-built in `frontend/dist`, so you only need Python 3.11+. To rebuild the UI: `cd frontend && npm install && npm run build` (use `npm run dev` to watch).

### Demo accounts (seeded)

| Role | Email | Password |
|---|---|---|
| Admin (placeholder name) | admin@origintheory.io | `Admin@123` |
| Project Manager (placeholder name) | pm@origintheory.io | `Welcome@123` |
| Sarvadnya Patil, Web / Software Dev | sarvadnya@origintheory.io | `Welcome@123` |
| Manmohan Havanur, Cybersecurity / VAPT | manmohan@origintheory.io | `Welcome@123` |
| Prasanna Hosmani, Media / AI & ML | prasanna@origintheory.io | `Welcome@123` |

Reset demo data any time: `cd backend && python -m app.seed.seed --reset`. Dates are generated relative to *today*, so dashboards always show live-looking overdue / due-soon work. "Aditi Rao" and "Rohan Mehta" are placeholder names for the admin and PM; rename them in the app.

## What's included

| Module | Highlights |
|---|---|
| **Auth** | JWT access + refresh tokens, PBKDF2 password hashing, login throttling (429 after 5 failures), change password, role-based route guards, auto token refresh |
| **Team** | Profiles, role, primary responsibility, responsibility areas, skills, search/filter, add/edit/deactivate (admin), workload stats per person |
| **Projects & Clients** | Client CRUD, project CRUD, members with project roles, progress computed from tasks, deadline flags, threaded project discussion, activity log |
| **Tasks** | Kanban (drag & drop, persisted ordering) + sortable list, task drawer (details, checklist, comments), My Tasks (Overdue / Today / Week / Later), All Tasks with filters |
| **Dashboard & Analytics** | Role-aware dashboards (org / managed projects / personal), completed-vs-created trend, status donut, workload, upcoming deadlines, projects at risk, team performance table (on-time %, cycle time) with CSV export, project analytics |
| **Extras** | Light/dark theme, responsive layout, computed notifications (overdue, due soon, new assignments), activity feed |

### Roles

| | Admin | Project Manager | Team Member |
|---|---|---|---|
| Users / roles | create, edit, deactivate | view | view, edit own profile |
| Clients | full | create / edit | no access |
| Projects | all | create; manage **own** | view own memberships |
| Tasks | all | manage in **own** projects | edit status/notes of **own** tasks, comment |
| Analytics | organization | own projects | personal dashboard only |

Permissions are enforced on the API (403), not just hidden in the UI.

## Architecture

```
backend/app
  main.py            ASGI app, CORS, static serving of the built UI
  core/              config, security (JWT, hashing, throttle), http (auth + RBAC + validation decorator)
  db/database.py     SQLite schema + data access (demo DB)
  schemas.py         Pydantic v2 request validation
  api/               auth, users, clients, projects, tasks, dashboard (REST /api/v1/...)
  services/common.py activity log, serializers, permission checks
  seed/seed.py       demo data
  tests/             24 pytest tests (auth, RBAC, lifecycle, analytics correctness)
frontend/src         React + TypeScript (features/, components/, lib/)
```

REST API under `/api/v1` (errors use one envelope: `{"error": {"code", "message", "details"}}`). Key routes: `/auth/*`, `/users`, `/clients`, `/projects` (+ `/members`, `/comments`, `/activity`), `/tasks` (+ `/move`, `/comments`, `/subtasks`), `/dashboard/overview`, `/analytics/team`, `/analytics/projects`, `/notifications`.

Run tests: `cd backend && python -m pytest -q`

## Moving to the full target stack (planned)

This build was produced in an environment that could not download packages, so a few pieces are lightweight equivalents that were built, tested and verified here. Each is isolated, so swapping is mechanical:

| Target | Today | Migration |
|---|---|---|
| FastAPI | Starlette (FastAPI's foundation) + Pydantic v2 + a small `@endpoint` decorator | Convert each handler in `app/api/*` to a FastAPI route, using `Depends` for auth/RBAC (the same checks in `core/http.py`). Schemas in `schemas.py` can be reused as-is |
| PostgreSQL + SQLAlchemy + Alembic | SQLite, hand-written SQL in `db/database.py` | The schema in `database.py` maps 1:1 to SQLAlchemy models; replace the `q/q1/raw1` helpers. Dashboard aggregates are already SQL |
| Tailwind CSS | Hand-written design system in `src/styles.css` (CSS variables, light + dark) | Port tokens into `tailwind.config`; class names are semantic and few |
| Recharts | d3-scale / d3-shape SVG charts in `components/charts.tsx` | Replace 3 components (`Donut`, `TrendChart`, `HBars`) with Recharts equivalents |
| React Router / TanStack Query | tiny hash router + SWR-style `useQuery` | API surface is the same (`useQuery(key, fn)`, `invalidate()`) |
| Vite | esbuild bundler (`build.mjs`) | Standard Vite + React setup |

Production checklist: set `OT_SECRET_KEY`, restrict `OT_CORS_ORIGINS`, move login throttling to Redis, use httpOnly cookies for refresh tokens, enable HTTPS.

## Roadmap (designed-for, not built)

Schema placeholders already exist for `notifications`, `files`, `attendance`. Next: email/push reminders, file sharing (S3), client portal (Client role), attendance, real-time updates, AI assistant (summaries, risk detection, status reports).
