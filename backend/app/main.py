"""OriginTheory Workspace API (Starlette). Run: uvicorn app.main:app --reload"""
import os

from contextlib import asynccontextmanager

from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse, JSONResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from .api import auth, clients, dashboard, projects, tasks, users
from .core import config
from .db.database import init_db


def health(request):
    return JSONResponse({"status": "ok", "service": "origintheory-workspace", "version": "1.0.0"})


def meta(request):
    return JSONResponse({"roles": config.ROLES, "project_statuses": config.PROJECT_STATUSES,
                         "task_statuses": config.TASK_STATUSES, "priorities": config.PRIORITIES,
                         "client_statuses": config.CLIENT_STATUSES})


api_routes = [Route("/health", health), Route("/meta", meta)]
for mod in (auth, users, clients, projects, tasks, dashboard):
    api_routes += mod.routes


def _spa(request):
    index = os.path.join(config.STATIC_DIR, "index.html")
    if os.path.exists(index):
        return FileResponse(index)
    return JSONResponse({"message": "API running. Build the frontend to serve the UI. Docs: README.md"})


def _not_found(request, exc):
    return JSONResponse({"error": {"code": "not_found", "message": "Route not found", "details": None}}, status_code=404)


def _method(request, exc):
    return JSONResponse({"error": {"code": "method_not_allowed", "message": "Method not allowed", "details": None}}, status_code=405)


routes = [Mount("/api/v1", routes=api_routes)]
if os.path.isdir(os.path.join(config.STATIC_DIR, "assets")):
    routes.append(Mount("/assets", StaticFiles(directory=os.path.join(config.STATIC_DIR, "assets")), name="assets"))
routes.append(Route("/{path:path}", _spa))

@asynccontextmanager
async def lifespan(app):
    init_db()
    yield


app = Starlette(
    routes=routes,
    middleware=[Middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"],
                           allow_headers=["*"], allow_credentials=False)],
    lifespan=lifespan,
    exception_handlers={404: _not_found, 405: _method},
)
