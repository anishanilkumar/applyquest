from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.applications import update_application_status
from app.models.application import ApplicationStatus


def make_db(application):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = application
    return db


def make_application(status):
    return SimpleNamespace(
        id="app-1",
        status=status,
        followup_flagged=False,
        followed_up_at=None,
        company_name="Acme",
        position_title="SWE",
        location="Berlin",
        salary_range=None,
    )


def make_user():
    return SimpleNamespace(id="user-1", name="Alice", points=100)


REOPEN_TARGETS = [
    ApplicationStatus.APPLIED,
    ApplicationStatus.REPLIED,
    ApplicationStatus.PHONE_SCREEN,
    ApplicationStatus.TECHNICAL_ROUND_1,
    ApplicationStatus.TECHNICAL_ROUND_2,
    ApplicationStatus.FINAL_ROUND,
    ApplicationStatus.OFFER,
]


@pytest.mark.parametrize("closed", [ApplicationStatus.REJECTED, ApplicationStatus.GHOSTED])
@pytest.mark.parametrize("target", REOPEN_TARGETS)
@patch("app.core.email.notify_offer")
@patch("app.core.email.notify_interview")
def test_closed_application_can_be_reopened(_interview, _offer, closed, target):
    app = make_application(closed)

    update_application_status(db=make_db(app), id="app-1", new_status=target, current_user=make_user())

    assert app.status == target


def test_ghosted_can_still_become_rejected():
    app = make_application(ApplicationStatus.GHOSTED)

    update_application_status(
        db=make_db(app), id="app-1", new_status=ApplicationStatus.REJECTED, current_user=make_user()
    )

    assert app.status == ApplicationStatus.REJECTED


@pytest.mark.parametrize("target", [ApplicationStatus.SHORTLISTED, ApplicationStatus.REJECTED])
def test_rejected_cannot_go_back_to_shortlisted_or_itself(target):
    app = make_application(ApplicationStatus.REJECTED)

    with pytest.raises(HTTPException) as exc:
        update_application_status(db=make_db(app), id="app-1", new_status=target, current_user=make_user())

    assert exc.value.status_code == 400


# --- step back one stage ---

STEP_BACKS = [
    (ApplicationStatus.APPLIED, ApplicationStatus.SHORTLISTED),
    (ApplicationStatus.REPLIED, ApplicationStatus.APPLIED),
    (ApplicationStatus.PHONE_SCREEN, ApplicationStatus.REPLIED),
    (ApplicationStatus.TECHNICAL_ROUND_1, ApplicationStatus.PHONE_SCREEN),
    (ApplicationStatus.TECHNICAL_ROUND_2, ApplicationStatus.TECHNICAL_ROUND_1),
    (ApplicationStatus.FINAL_ROUND, ApplicationStatus.TECHNICAL_ROUND_2),
    (ApplicationStatus.OFFER, ApplicationStatus.FINAL_ROUND),
]


@pytest.mark.parametrize("current,previous", STEP_BACKS)
@patch("app.core.email.notify_offer")
@patch("app.core.email.notify_interview")
def test_any_active_stage_can_step_back_one_stage_silently(interview, offer, current, previous):
    app = make_application(current)

    update_application_status(db=make_db(app), id="app-1", new_status=previous, current_user=make_user())

    assert app.status == previous
    interview.assert_not_called()
    offer.assert_not_called()


@pytest.mark.parametrize("current,target", [
    (ApplicationStatus.TECHNICAL_ROUND_2, ApplicationStatus.PHONE_SCREEN),
    (ApplicationStatus.OFFER, ApplicationStatus.APPLIED),
])
def test_cannot_jump_back_more_than_one_stage(current, target):
    app = make_application(current)

    with pytest.raises(HTTPException) as exc:
        update_application_status(db=make_db(app), id="app-1", new_status=target, current_user=make_user())

    assert exc.value.status_code == 400
