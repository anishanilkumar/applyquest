from datetime import date

DECISION_STALE_DAYS = 3
TERMINAL_STATUSES = {'Rejected', 'Ghosted'}


def _days_since(d: date, today: date) -> int:
    return (today - d).days


def _in_queue(app) -> bool:
    return bool(app.followup_flagged) and str(app.status) not in TERMINAL_STATUSES


def needs_followup(app, today: date) -> bool:
    return _in_queue(app) and app.followed_up_at is None


def awaiting_response(app, today: date) -> bool:
    if not _in_queue(app) or app.followed_up_at is None:
        return False
    return _days_since(app.followed_up_at, today) < DECISION_STALE_DAYS


def needs_decision(app, today: date) -> bool:
    if not _in_queue(app) or app.followed_up_at is None:
        return False
    return _days_since(app.followed_up_at, today) >= DECISION_STALE_DAYS


def classify(app, today: date) -> str:
    """Returns 'needs_followup' | 'awaiting_response' | 'needs_decision' | 'ok'."""
    if needs_decision(app, today):
        return 'needs_decision'
    if awaiting_response(app, today):
        return 'awaiting_response'
    if needs_followup(app, today):
        return 'needs_followup'
    return 'ok'
