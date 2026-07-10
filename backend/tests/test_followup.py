from types import SimpleNamespace
from unittest.mock import patch

from datetime import date, datetime, timedelta

import pytest

from app.core.followup import (
    classify,
    needs_decision,
    needs_followup,
    awaiting_response,
    DECISION_STALE_DAYS,
)

TODAY = date(2026, 4, 27)


def make_app(status="Applied", followed_up_at=None, days_since_update=0, followup_flagged=True):
    last = TODAY - timedelta(days=days_since_update)
    return SimpleNamespace(
        status=status,
        followed_up_at=followed_up_at,
        followup_flagged=followup_flagged,
        updated_at=datetime(last.year, last.month, last.day, 10, 0),
        applied_date=last,
    )


# --- needs_followup ---

def test_flagged_app_needs_followup_immediately():
    app = make_app(status="Applied", days_since_update=0)
    assert needs_followup(app, TODAY) is True


def test_unflagged_app_never_needs_followup_however_stale():
    app = make_app(status="Applied", days_since_update=30, followup_flagged=False)
    assert needs_followup(app, TODAY) is False


def test_app_with_followup_already_set_does_not_need_followup():
    app = make_app(status="Applied", days_since_update=10, followed_up_at=TODAY - timedelta(days=1))
    assert needs_followup(app, TODAY) is False


def test_rejected_app_never_needs_followup():
    app = make_app(status="Rejected", days_since_update=30)
    assert needs_followup(app, TODAY) is False


def test_ghosted_app_never_needs_followup():
    app = make_app(status="Ghosted", days_since_update=30)
    assert needs_followup(app, TODAY) is False


@pytest.mark.parametrize("status", [
    "Shortlisted", "Applied", "Replied", "Phone Screen",
    "Technical Round 1", "Technical Round 2", "Final Round", "Offer",
])
def test_all_non_terminal_statuses_are_eligible_when_flagged(status):
    app = make_app(status=status)
    assert needs_followup(app, TODAY) is True


# --- awaiting_response ---

def test_followed_up_today_is_awaiting():
    app = make_app(followed_up_at=TODAY)
    assert awaiting_response(app, TODAY) is True


def test_followed_up_within_window_is_awaiting():
    app = make_app(followed_up_at=TODAY - timedelta(days=DECISION_STALE_DAYS - 1))
    assert awaiting_response(app, TODAY) is True


def test_followed_up_at_boundary_is_not_awaiting():
    app = make_app(followed_up_at=TODAY - timedelta(days=DECISION_STALE_DAYS))
    assert awaiting_response(app, TODAY) is False


def test_no_followup_is_not_awaiting():
    app = make_app()
    assert awaiting_response(app, TODAY) is False


def test_unflagged_app_is_not_awaiting():
    app = make_app(followed_up_at=TODAY, followup_flagged=False)
    assert awaiting_response(app, TODAY) is False


def test_terminal_status_is_not_awaiting():
    app = make_app(status="Rejected", followed_up_at=TODAY - timedelta(days=1))
    assert awaiting_response(app, TODAY) is False


# --- needs_decision ---

def test_followed_up_3_days_ago_needs_decision():
    app = make_app(followed_up_at=TODAY - timedelta(days=DECISION_STALE_DAYS))
    assert needs_decision(app, TODAY) is True


def test_followed_up_2_days_ago_does_not_need_decision():
    app = make_app(followed_up_at=TODAY - timedelta(days=DECISION_STALE_DAYS - 1))
    assert needs_decision(app, TODAY) is False


def test_no_followup_does_not_need_decision():
    app = make_app()
    assert needs_decision(app, TODAY) is False


def test_unflagged_app_does_not_need_decision():
    app = make_app(followed_up_at=TODAY - timedelta(days=5), followup_flagged=False)
    assert needs_decision(app, TODAY) is False


def test_terminal_status_does_not_need_decision():
    app = make_app(status="Ghosted", followed_up_at=TODAY - timedelta(days=5))
    assert needs_decision(app, TODAY) is False


# --- classify ---

def test_classify_ok_for_unflagged_app():
    app = make_app(days_since_update=30, followup_flagged=False)
    assert classify(app, TODAY) == "ok"


def test_classify_needs_followup_for_flagged_app():
    app = make_app(days_since_update=0)
    assert classify(app, TODAY) == "needs_followup"


def test_classify_awaiting_response_after_recent_followup():
    app = make_app(followed_up_at=TODAY - timedelta(days=1))
    assert classify(app, TODAY) == "awaiting_response"


def test_classify_needs_decision_after_stale_followup():
    app = make_app(followed_up_at=TODAY - timedelta(days=DECISION_STALE_DAYS))
    assert classify(app, TODAY) == "needs_decision"


def test_classify_ok_for_terminal_even_if_flagged():
    app = make_app(status="Rejected", days_since_update=30)
    assert classify(app, TODAY) == "ok"


# --- notify_weekly_summary includes followup counts ---

def test_notify_weekly_summary_includes_followup_row():
    from app.core.email import notify_weekly_summary

    with patch("app.core.email._send") as mock_send, \
         patch("app.core.email.settings") as mock_settings:
        mock_settings.RESEND_API_KEY = "test-key"
        mock_settings.MENTOR_EMAILS = "mentor@example.com"

        notify_weekly_summary(
            user_name="Alice", current_streak=5, longest_streak=10,
            level=2, level_name="Active Applicant", points=150,
            total_apps=20, apps_this_week=3, response_rate=30,
            interview_rate=10, active_apps=15,
            followup_needed=2, decision_needed=1,
        )

        mock_send.assert_called_once()
        _, _, html = mock_send.call_args[0]
        assert "Followup needed" in html
        assert "2 pending" in html
        assert "1 need a decision" in html


def test_notify_weekly_summary_omits_followup_row_when_zero():
    from app.core.email import notify_weekly_summary

    with patch("app.core.email._send") as mock_send, \
         patch("app.core.email.settings") as mock_settings:
        mock_settings.RESEND_API_KEY = "test-key"
        mock_settings.MENTOR_EMAILS = "mentor@example.com"

        notify_weekly_summary(
            user_name="Alice", current_streak=5, longest_streak=10,
            level=2, level_name="Active Applicant", points=150,
            total_apps=20, apps_this_week=3, response_rate=30,
            interview_rate=10, active_apps=15,
            followup_needed=0, decision_needed=0,
        )

        _, _, html = mock_send.call_args[0]
        assert "Followup needed" not in html
