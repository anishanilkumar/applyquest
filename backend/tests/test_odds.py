from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.core import odds
from app.core.odds import K, Waiting, beta_cdf, beta_quantile, calibration, fit_band, odds_model
from app.models.application import ApplicationStatus as S

# These mirror frontend/src/__tests__/odds.test.ts — the two must agree.

NOW = datetime(2026, 11, 19, 12, tzinfo=timezone.utc)


def app(status, effort="Full", role="Backend", fit=80, days_ago=0, path=(), reply_after=None, predicted=None):
    """An application sent days_ago, moving along path one day apart (or reply_after days for the first step)."""
    sent = (NOW - timedelta(days=days_ago)).replace(tzinfo=None)
    history = []
    for i, s in enumerate(path[1:]):
        step = (reply_after if reply_after is not None else 1) + i
        history.append(SimpleNamespace(old_status=path[i], new_status=s, changed_at=sent + timedelta(days=step)))
    return SimpleNamespace(status=status, effort=effort, role_type=role, fit_score=fit,
                           applied_date=sent.date(), history=history, predicted_p=predicted)


INTERVIEW = (S.SHORTLISTED, S.APPLIED, S.REPLIED, S.PHONE_SCREEN)


def sent(effort, role, fit, interview=False, days_ago=0):
    if interview:
        return app(S.PHONE_SCREEN, effort, role, fit, days_ago, INTERVIEW)
    return app(S.REJECTED, effort, role, fit, days_ago, (S.SHORTLISTED, S.APPLIED, S.REJECTED))


HISTORY = [sent("Full", "Backend", 80, True), sent("Full", "Backend", 80),
           *[sent("Generic", "AI/ML", 50) for _ in range(8)]]


def test_fit_band_uses_the_evaluation_verdict_bands():
    assert [fit_band(x) for x in (80, 75, 60, 45, 10, None)] == [
        "Strong (75+)", "Strong (75+)", "Good (60-74)", "Moderate (45-59)", "Weak (<45)", "Unscored"]


def test_beta_quantile_matches_closed_forms():
    # Beta(1, 1) is uniform; Beta(2, 1) has CDF x², so its quantile is √q.
    assert beta_quantile(0.3, 1, 1) == pytest.approx(0.3, abs=1e-9)
    assert beta_quantile(0.25, 2, 1) == pytest.approx(0.5, abs=1e-9)
    assert beta_quantile(0.5, 7, 7) == pytest.approx(0.5, abs=1e-9)
    # scipy.stats.beta: cdf(0.2, 3, 40) and the 5% / 95% points of Beta(11.33, 328.7).
    assert beta_cdf(0.2, 3, 40) == pytest.approx(0.994443827, abs=1e-9)
    assert beta_quantile(0.05, 11.33, 328.7) == pytest.approx(0.019038233, abs=1e-9)
    assert beta_quantile(0.95, 11.33, 328.7) == pytest.approx(0.050714908, abs=1e-9)


def test_counts_only_sent_applications_in_the_base_rate():
    drafts = [app(S.SHORTLISTED), app(S.NOT_APPLYING, path=(S.SHORTLISTED, S.NOT_APPLYING))]
    m = odds_model(HISTORY + drafts, NOW)
    assert (m.base.interviews, m.base.sent) == (1, 10)
    assert m.base.p == pytest.approx(0.1)


def test_shrinks_each_segment_toward_the_base_rate():
    full = odds_model(HISTORY, NOW).segment("Tier", app(S.SHORTLISTED))
    assert full.p == pytest.approx((1 + K * 0.1) / (2 + K))
    assert full.lo < full.p < full.hi


def test_gives_a_draft_the_geometric_mean_of_its_three_segments():
    m = odds_model(HISTORY, NOW)
    r = (1 + K * 0.1) / (2 + K)
    assert m.p(app(S.SHORTLISTED)) == pytest.approx(r)
    unseen = app(S.SHORTLISTED, role="Data")
    assert m.p(unseen) == pytest.approx((r * 0.1 * r) ** (1 / 3))
    assert m.p(app(S.SHORTLISTED, "Generic", "AI/ML", 50)) < m.p(unseen)


def test_is_zero_with_no_track_record():
    assert odds_model([], NOW).p(app(S.SHORTLISTED)) == 0


def test_a_fresh_application_is_only_part_of_a_no():
    fresh = app(S.APPLIED, days_ago=7, path=(S.SHORTLISTED, S.APPLIED))
    stale = app(S.APPLIED, days_ago=60, path=(S.SHORTLISTED, S.APPLIED))
    e_fresh, e_stale = odds_model(HISTORY + [fresh, stale], NOW).evidence[-2:]
    # HISTORY's one reply came a day after sending: G(7) = (1·1 + 5·7/42) / 6.
    assert e_fresh.f == pytest.approx((1 + 5 * 7 / 42) / 6)
    assert e_stale.f == 1.0
    assert odds_model(HISTORY + [fresh], NOW).base.p > odds_model(HISTORY + [stale], NOW).base.p


def test_waiting_blends_reply_delays_with_the_ramp():
    assert Waiting([])(21) == pytest.approx(0.5)
    w = Waiting([3, 5, 10, 12, 20])
    # 3 of 5 replies by day 10, the ramp at 10/42, each worth 5 observations.
    assert w(10) == pytest.approx((5 * 3 / 5 + 5 * 10 / 42) / 10)


def test_reads_reply_delays_from_history():
    apps = [app(S.PHONE_SCREEN, days_ago=30, path=INTERVIEW, reply_after=9),
            app(S.REJECTED, days_ago=30, path=(S.SHORTLISTED, S.APPLIED, S.REJECTED))]
    assert odds.reply_delays(apps) == [10]


def test_older_evidence_fades():
    recent = odds_model(HISTORY[1:] + [sent("Full", "Backend", 80, True, days_ago=0)], NOW)
    old = odds_model(HISTORY[1:] + [sent("Full", "Backend", 80, True, days_ago=70)], NOW)
    assert recent.base.p > old.base.p
    assert old.evidence[-1].w == pytest.approx(odds.DECAY ** 10)


def test_still_alive_falls_as_the_silence_grows():
    m = odds_model(HISTORY, NOW)
    p = 0.05
    assert m.still_alive(p, 0) == pytest.approx(p)
    assert m.still_alive(p, 10) < p
    assert m.still_alive(p, 60) == 0


def test_calibration_scores_settled_predictions_only():
    apps = [app(S.PHONE_SCREEN, path=INTERVIEW, predicted=0.2),
            app(S.REJECTED, path=(S.SHORTLISTED, S.APPLIED, S.REJECTED), predicted=0.1),
            app(S.APPLIED, days_ago=3, path=(S.SHORTLISTED, S.APPLIED), predicted=0.5),
            app(S.REJECTED, path=(S.SHORTLISTED, S.APPLIED, S.REJECTED))]
    c = calibration(odds_model(apps, NOW))
    assert c["n"] == 2
    assert c["expected"] == pytest.approx(0.3)
    assert c["observed"] == 1
    assert c["brier"] == pytest.approx((0.8 ** 2 + 0.1 ** 2) / 2)


def test_summary_is_plain_data():
    s = odds.summary(HISTORY, NOW)
    assert s["base"]["sent"] == 10
    assert s["calibration"]["n"] == 0
    assert {"kind", "name", "alpha", "beta", "p", "lo", "hi"} <= set(s["segments"][0])
