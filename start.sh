#!/usr/bin/env bash
# OriginTheory Workspace - one-command start (demo mode)
set -e
cd "$(dirname "$0")/backend"
[ -d .venv ] || python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -q
[ -f data/origintheory.db ] || python -m app.seed.seed
echo "Open http://localhost:8000  (Ctrl+C to stop)"
python -m uvicorn app.main:app --port 8000
