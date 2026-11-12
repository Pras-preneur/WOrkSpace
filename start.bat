@echo off
REM OriginTheory Workspace - one-click start for Windows (demo mode)
cd /d "%~dp0backend"
if not exist .venv ( py -m venv .venv )
call .venv\Scripts\activate
pip install -r requirements.txt -q
if not exist data\origintheory.db ( python -m app.seed.seed )
echo.
echo  Open http://localhost:8000  (Ctrl+C to stop)
python -m uvicorn app.main:app --port 8000
