import math
import random
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.core import model
from app.core.model import cholesky, features, fit, source_group
from app.models.application import ApplicationStatus as S

NOW = datetime(2026, 11, 19, 12, tzinfo=timezone.utc)
INT = (S.SHORTLISTED, S.APPLIED, S.REPLIED, S.PHONE_SCREEN)
REJ = (S.SHORTLISTED, S.APPLIED, S.REJECTED)


def app(status, effort="Full", role="Backend", fit_score=80, cover=None, source="LinkedIn", days_ago=30, path=(), i=0):
    sent = (NOW - timedelta(days=days_ago)).replace(tzinfo=None)
    history = [SimpleNamespace(old_status=path[j], new_status=s, changed_at=sent + timedelta(days=5 + j))
               for j, s in enumerate(path[1:])]
    return SimpleNamespace(id=f"a{i}", status=status, effort=effort, role_type=role, fit_score=fit_score,
                           cover_letter_file=cover, job_board_source=source, applied_date=sent.date(),
                           history=history, predicted_p=None, updated_at=sent)


def synthetic(n=1500, seed=0):
    """Full applications get interviews at 0.15, Generic at 0.02; nothing else matters."""
    rng = random.Random(seed)
    out = []
    for i in range(n):
        effort = rng.choice(["Full", "Generic"])
        role = rng.choice(["Backend", "Fullstack", "AI/ML"])
        y = rng.random() < (0.15 if effort == "Full" else 0.02)
        out.append(app(S.PHONE_SCREEN if y else S.REJECTED, effort, role, rng.randint(40, 95),
                       days_ago=rng.randint(10, 60), path=INT if y else REJ, i=i))
    return out


def test_source_groups():
    assert [source_group(s) for s in ("LinkedIn (inbound)", "email reconciliation", "Ashby (company career page)",
                                      "Company website", "EURES", None)] == [
        "LinkedIn", "Email", "ATS", "Company site", "Other", "Other"]


def test_features_name_every_group():
    assert features(app(S.SHORTLISTED, cover="cl.tex")) == [
        "Tier=Full", "Role=Backend", "Fit=Strong (75+)", "Cover letter=Yes", "Source=LinkedIn"]


def test_cholesky_reproduces_the_matrix():
    a = [[4.0, 2.0, 0.4], [2.0, 5.0, 1.0], [0.4, 1.0, 3.0]]
    L = cholesky(a)
    back = [[sum(L[i][k] * L[j][k] for k in range(3)) for j in range(3)] for i in range(3)]
    assert [x for row in back for x in row] == pytest.approx([x for row in a for x in row])


def test_recovers_an_effect_and_ignores_noise():
    f = fit(synthetic(), NOW)
    coef = {c["name"]: c for c in f.coefficients()}
    assert coef["Tier=Full"]["mean"] - coef["Tier=Generic"]["mean"] > 1.0
    # Role carries no signal: each role effect is within two sds of zero.
    for role in ("Backend", "Fullstack", "AI/ML"):
        assert abs(coef[f"Role={role}"]["mean"]) < 2 * coef[f"Role={role}"]["sd"]
    full = f.p(app(S.SHORTLISTED, "Full"))
    generic = f.p(app(S.SHORTLISTED, "Generic"))
    assert full == pytest.approx(0.15, abs=0.04)
    assert generic == pytest.approx(0.02, abs=0.015)


def test_the_interval_holds_the_mean_and_narrows_with_data():
    small = fit(synthetic(200, seed=1), NOW)
    large = fit(synthetic(3000, seed=1), NOW)
    d = app(S.SHORTLISTED, "Full")
    lo, hi = small.interval(d)
    assert lo < small.p(d) < hi
    lo2, hi2 = large.interval(d)
    assert hi2 - lo2 < hi - lo


def test_little_data_means_heavy_pooling():
    assert fit(synthetic(150, seed=2), NOW).sigma <= fit(synthetic(3000, seed=2), NOW).sigma


def test_a_level_never_seen_falls_back_to_the_rest():
    f = fit(synthetic(300), NOW)
    assert 0 < f.p(app(S.SHORTLISTED, "Full", role="Quantum")) < 1


def test_no_track_record_no_model():
    assert fit([], NOW) is None


def test_thompson_draws_share_one_beta_and_vary_between_calls():
    apps = synthetic(400) + [app(S.SHORTLISTED, "Full", i=9001), app(S.SHORTLISTED, "Generic", i=9002)]
    f = fit(apps, NOW)
    rng = random.Random(3)
    one = model.drafts(apps, f, rng)
    assert set(one) == {"a9001", "a9002"}
    beta = f.sample(random.Random(3))
    assert one["a9001"]["draw"] == pytest.approx(f.p_with(beta, apps[-2]))
    two = model.drafts(apps, f, random.Random(4))
    assert one["a9001"]["draw"] != two["a9001"]["draw"]
    assert one["a9001"]["p"] == two["a9001"]["p"]


def test_the_fit_is_cached_until_the_applications_change():
    model._cache.clear()
    apps = synthetic(200)
    first = model.cached_fit(apps, NOW)
    assert model.cached_fit(apps, NOW) is first
    apps.append(app(S.REJECTED, path=REJ, i=5000, days_ago=1))
    assert model.cached_fit(apps, NOW) is not first


def test_summary_is_plain_data():
    s = model.summary(synthetic(200) + [app(S.SHORTLISTED, i=7)], NOW, random.Random(0))
    assert s["coefficients"][0]["name"] == "(intercept)"
    assert set(s["drafts"]["a7"]) == {"p", "lo", "hi", "draw"}
    assert all(math.isfinite(c["mean"]) for c in s["coefficients"])
