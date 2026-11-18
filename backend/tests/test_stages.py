from datetime import datetime, timedelta
from types import SimpleNamespace

from app.core.stages import effective_history, has_positive_response, has_reached_interview, is_submitted
from app.models.application import ApplicationStatus as S

T0 = datetime(2026, 10, 1)


def app(status, *moves):
    history = [SimpleNamespace(old_status=o, new_status=n, changed_at=T0 + timedelta(days=i))
               for i, (o, n) in enumerate(moves)]
    return SimpleNamespace(status=status, history=history)


# These mirror frontend/src/__tests__/stages.test.ts — the two must agree.

def test_drafts_and_skipped_drafts_are_not_sent():
    assert not is_submitted(app(S.SHORTLISTED))
    assert not is_submitted(app(S.REJECTED, (S.SHORTLISTED, S.REJECTED)))
    assert is_submitted(app(S.REJECTED, (S.SHORTLISTED, S.APPLIED), (S.APPLIED, S.REJECTED)))
    assert is_submitted(app(S.APPLIED))


def test_a_rejection_is_not_a_positive_response():
    assert not has_positive_response(app(S.REJECTED, (S.APPLIED, S.REJECTED)))
    assert not has_positive_response(app(S.GHOSTED, (S.APPLIED, S.GHOSTED)))
    assert has_positive_response(app(S.REJECTED, (S.APPLIED, S.REPLIED), (S.REPLIED, S.REJECTED)))


def test_interview_counts_once_reached_even_after_rejection():
    a = app(S.REJECTED, (S.APPLIED, S.PHONE_SCREEN), (S.PHONE_SCREEN, S.REJECTED))
    assert has_reached_interview(a)


def test_a_corrected_step_does_not_count():
    # Moved to Phone Screen by mistake, then stepped back to Replied.
    a = app(S.REPLIED, (S.APPLIED, S.REPLIED), (S.REPLIED, S.PHONE_SCREEN), (S.PHONE_SCREEN, S.REPLIED))
    assert effective_history(a) == [(S.APPLIED, S.REPLIED)]
    assert not has_reached_interview(a)
    assert has_positive_response(a)


def test_a_draft_set_aside_is_not_sent_until_it_is():
    assert not is_submitted(app(S.NOT_APPLYING, (S.SHORTLISTED, S.NOT_APPLYING)))
    back = app(S.SHORTLISTED, (S.SHORTLISTED, S.NOT_APPLYING), (S.NOT_APPLYING, S.SHORTLISTED))
    assert not is_submitted(back) and effective_history(back) == []
    sent = app(S.APPLIED, (S.SHORTLISTED, S.NOT_APPLYING), (S.NOT_APPLYING, S.APPLIED))
    assert is_submitted(sent) and effective_history(sent) == [(S.SHORTLISTED, S.APPLIED)]
