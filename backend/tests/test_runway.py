from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.core.runway import chance_of_offer, compute_runway, pace_for
from app.models.application import ApplicationStatus as S

# These mirror frontend/src/__tests__/runway.test.ts — the two must agree.

NOW = datetime(2026, 10, 15, 12, tzinfo=timezone.utc)
DEADLINE = date(2027, 3, 31)


def app(status, applied_days_ago, path=()):
    history = [SimpleNamespace(old_status=path[i], new_status=s,
                               changed_at=(NOW - timedelta(days=applied_days_ago - i - 1)).replace(tzinfo=None))
               for i, s in enumerate(path[1:])]
    return SimpleNamespace(status=status, applied_date=(NOW - timedelta(days=applied_days_ago)).date(), history=history)


def runway(apps, deadline=DEADLINE, mult=1.0):
    return compute_runway(apps, deadline, 6, 4, NOW, mult)


def test_works_back_from_the_deadline():
    r = runway([])
    assert r.offer_by.date() == date(2027, 3, 3)
    assert r.last_apply_by.date() == date(2027, 1, 20)
    assert round(r.weeks_left) == 14


def test_leaves_out_drafts_and_counts_pace_from_four_weeks():
    apps = [app(S.SHORTLISTED, 1), app(S.APPLIED, 3), app(S.APPLIED, 10), app(S.REJECTED, 20), app(S.GHOSTED, 60)]
    r = runway(apps)
    assert r.stages[0].trials == 4
    assert r.pace_per_week == pytest.approx(3 / 4)


def test_pulls_rates_towards_the_prior():
    apps = [app(S.REJECTED, 50, (S.APPLIED, S.PHONE_SCREEN, S.REJECTED))] + [app(S.REJECTED, 50) for _ in range(19)]
    reply, interview, offer = runway(apps).stages
    assert reply.successes == 1
    assert reply.rate == pytest.approx(2 / 40)
    assert interview.successes == 1
    assert offer.successes == 0
    assert offer.rate == pytest.approx(1 / 6)
    assert offer.assumed


def test_live_interviews_beat_fresh_applications_and_stale_ones_drop():
    base = [app(S.REJECTED, 80) for _ in range(40)]
    assert runway(base + [app(S.APPLIED, 70)]).in_flight == 0
    fresh = runway(base + [app(S.APPLIED, 5)])
    interviewing = runway(base + [app(S.PHONE_SCREEN, 5, (S.APPLIED, S.REPLIED, S.PHONE_SCREEN))])
    assert interviewing.in_flight_chance > fresh.in_flight_chance


def test_scales_the_reply_rate():
    apps = [app(S.REJECTED, 50) for _ in range(40)]
    base, doubled = runway(apps), runway(apps, mult=2)
    assert doubled.stages[0].rate == pytest.approx(base.stages[0].rate * 2)
    assert doubled.applications_per_offer == pytest.approx(base.applications_per_offer / 2)


def test_no_weeks_left_once_the_last_date_has_passed():
    assert runway([], deadline=date(2026, 11, 1)).weeks_left == 0


def test_pace_for_a_target_reproduces_it():
    p, weeks, in_flight = 0.004, 14, 0.05
    pace = pace_for(0.8, p, weeks, in_flight)
    assert chance_of_offer(p, pace * weeks, in_flight) == pytest.approx(0.8)


def test_no_pace_needed_when_in_flight_meets_the_target():
    assert pace_for(0.5, 0.01, 10, 0.6) == 0
