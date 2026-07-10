from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.applications import set_followup_flag, update_application_status
from app.models.application import ApplicationStatus


def make_db(application):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = application
    return db


def make_application(status=ApplicationStatus.APPLIED, followup_flagged=False, followed_up_at=None):
    return SimpleNamespace(
        id="app-1",
        status=status,
        followup_flagged=followup_flagged,
        followed_up_at=followed_up_at,
        company_name="Acme",
        position_title="SWE",
        location="Berlin",
        salary_range=None,
    )


def make_user():
    return SimpleNamespace(id="user-1", name="Alice", points=100)


# --- POST /{id}/followup-flag ---

def test_flagging_sets_the_flag():
    app = make_application(followup_flagged=False)
    user = make_user()

    set_followup_flag(db=make_db(app), id="app-1", flagged=True, current_user=user)

    assert app.followup_flagged is True


def test_flagging_awards_no_points():
    app = make_application()
    user = make_user()

    set_followup_flag(db=make_db(app), id="app-1", flagged=True, current_user=user)

    assert user.points == 100


def test_unflagging_clears_pending_followup():
    app = make_application(followup_flagged=True, followed_up_at="2026-04-27")
    user = make_user()

    set_followup_flag(db=make_db(app), id="app-1", flagged=False, current_user=user)

    assert app.followup_flagged is False
    assert app.followed_up_at is None


def test_flagging_missing_application_404s():
    with pytest.raises(HTTPException) as exc:
        set_followup_flag(db=make_db(None), id="nope", flagged=True, current_user=make_user())
    assert exc.value.status_code == 404


# --- status change clears the flag ---

def test_status_change_clears_followup_flag():
    app = make_application(status=ApplicationStatus.APPLIED, followup_flagged=True, followed_up_at="2026-04-27")
    db = make_db(app)

    update_application_status(
        db=db, id="app-1", new_status=ApplicationStatus.REPLIED,
        notes=None, current_user=make_user(),
    )

    assert app.followup_flagged is False
    assert app.followed_up_at is None
    assert app.status == ApplicationStatus.REPLIED
