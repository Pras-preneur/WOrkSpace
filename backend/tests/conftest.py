import os
import tempfile

import pytest

_tmp = tempfile.mkdtemp()
os.environ["OT_DB_PATH"] = os.path.join(_tmp, "test.db")
os.environ["OT_PW_ITERATIONS"] = "2000"   # fast hashing in tests only

from starlette.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed.seed import seed  # noqa: E402
from app.core import security  # noqa: E402


@pytest.fixture(scope="session")
def client():
    seed(reset=True)
    with TestClient(app) as c:
        yield c


def login(client, email, pw="Welcome@123"):
    security.throttle._fails.clear()
    r = client.post("/api/v1/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def admin(client):
    return login(client, "admin@origintheory.io", "Admin@123")


@pytest.fixture(scope="session")
def pm(client):
    return login(client, "pm@origintheory.io")


@pytest.fixture(scope="session")
def dev(client):
    return login(client, "sarvadnya@origintheory.io")


@pytest.fixture(scope="session")
def sec(client):
    return login(client, "manmohan@origintheory.io")
