import sys
import types as _types
from types import SimpleNamespace
from unittest.mock import MagicMock

# Stub runtime deps that may not be installed in the test venv
sys.modules.setdefault("resend", MagicMock())

# The real app.core.config requires Postgres env vars and builds a live engine.
# Tests are pure unit tests, so stub it before anything imports it. The sqlite
# URI keeps create_engine (which is lazy) happy without ever opening a connection.
if "app.core.config" not in sys.modules:
    _cfg = _types.ModuleType("app.core.config")
    _cfg.settings = SimpleNamespace(
        PROJECT_NAME="ApplyQuest",
        API_V1_STR="/api/v1",
        SQLALCHEMY_DATABASE_URI="sqlite://",
        SHARE_PASSWORD="sharepassword",
        SECRET_KEY="test-secret",
        APPLYQUEST_API_KEY="",
        RESEND_API_KEY="",
        EMAIL_FROM="ApplyQuest <noreply@test.com>",
        USER_EMAIL="user@example.com",
        MENTOR_EMAILS="",
    )
    sys.modules["app.core.config"] = _cfg

import app.models.application  # noqa: F401,E402
import app.models.network  # noqa: F401,E402
import app.models.point_history  # noqa: F401,E402
import app.models.user  # noqa: F401,E402


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def no_game(request, monkeypatch):
    """The status endpoint's points need a real session; its tests use a MagicMock.

    core/quest.py is tested on its own (test_quest.py), so the endpoint's
    calls into it are stubbed everywhere else.
    """
    if request.module.__name__.endswith("test_quest"):
        return
    from app.api.v1.endpoints import applications
    from app.core import quest
    monkeypatch.setattr(quest, "on_move", lambda *a, **k: [])
    monkeypatch.setattr(applications, "_award_game", lambda *a, **k: [])
