from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.api.v1.endpoints.applications import update_application, update_application_status
from app.models.application import ApplicationStatus
from app.schemas.application import ApplicationUpdate


def make_db(application):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = application
    return db


def make_application(status=ApplicationStatus.SHORTLISTED, applied_date=None):
    return SimpleNamespace(
        id="app-1",
        status=status,
        applied_date=applied_date or date.today() - timedelta(days=5),
        company_name="Acme",
        position_title="SWE",
        location="Berlin",
        salary_range=None,
    )


def make_user():
    return SimpleNamespace(id="user-1", name="Alice")


# A shortlisted application was drafted, not sent: it counts as applied from
# the day it is actually submitted.

def test_submitting_a_shortlisted_application_dates_it_today():
    app = make_application()
    update_application_status(db=make_db(app), id="app-1", new_status=ApplicationStatus.APPLIED, notes=None, current_user=make_user())
    assert app.applied_date == date.today()


def test_later_transitions_keep_the_applied_date():
    drafted = date.today() - timedelta(days=5)
    app = make_application(status=ApplicationStatus.APPLIED, applied_date=drafted)
    update_application_status(db=make_db(app), id="app-1", new_status=ApplicationStatus.REJECTED, notes=None, current_user=make_user())
    assert app.applied_date == drafted


# Syncing ai-job-search metadata is bookkeeping, not the user working on the
# application, so it must not earn points.

@patch("app.core.gamification.add_points")
def test_sync_only_update_awards_no_points(add_points):
    app = make_application()
    update = ApplicationUpdate(fit_score=72, role_type="Fullstack", cv_file="cv/main_acme_swe.tex", effort="Full")
    update_application(db=make_db(app), id="app-1", application_in=update, current_user=make_user())
    add_points.assert_not_called()
    assert app.fit_score == 72


@patch("app.core.gamification.add_points")
def test_user_edit_still_awards_a_point(add_points):
    app = make_application()
    update = ApplicationUpdate(notes="Spoke to the recruiter", fit_score=72)
    update_application(db=make_db(app), id="app-1", application_in=update, current_user=make_user())
    add_points.assert_called_once()


def test_fit_score_is_bounded():
    import pytest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        ApplicationUpdate(fit_score=120)


def test_runway_settings_are_bounded():
    import pytest
    from pydantic import ValidationError
    from app.schemas.user import UserUpdate
    assert UserUpdate(search_deadline="2027-03-31", hiring_weeks=6).search_deadline == date(2027, 3, 31)
    with pytest.raises(ValidationError):
        UserUpdate(hiring_weeks=0)


@patch("app.core.gamification.add_points")
def test_archive_dir_is_a_sync_field(add_points):
    app = make_application()
    update_application(db=make_db(app), id="app-1", application_in=ApplicationUpdate(archive_dir="acme_swe"), current_user=make_user())
    add_points.assert_not_called()


def test_archive_dir_must_be_a_single_folder_name():
    import pytest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        ApplicationUpdate(archive_dir="../etc")
