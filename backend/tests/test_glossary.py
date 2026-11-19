import math
import re
from datetime import timedelta

import pytest

from app.core import glossary, stats
from app.models.application import ApplicationStatus as S
from tests.test_stats import NOW, TODAY, app, user

PLACEHOLDER = re.compile(r"\{(\w+)\}")


def summary(deadline=True):
    apps = ([app(S.REJECTED, TODAY - timedelta(days=20 + i), (S.SHORTLISTED, S.APPLIED, S.REJECTED)) for i in range(12)]
            + [app(S.PHONE_SCREEN, TODAY - timedelta(days=30), (S.SHORTLISTED, S.APPLIED, S.REPLIED, S.PHONE_SCREEN))]
            + [app(S.APPLIED, TODAY - timedelta(days=2), (S.SHORTLISTED, S.APPLIED)), app(S.SHORTLISTED, created_days_ago=9)])
    u = user() if deadline else user(deadline=None)
    return stats.summary(u, apps, [], set(), NOW)


def test_every_entry_has_a_title_and_a_formula():
    for key, e in summary()["glossary"].items():
        assert e["title"] and e["formula"], key


def test_server_filled_entries_leave_no_placeholders():
    for key, e in summary()["glossary"].items():
        left = {m for line in e["here"] for m in PLACEHOLDER.findall(line)}
        assert left <= set(e["vars"]), (key, left)


def test_row_entries_name_their_placeholders():
    g = summary()["glossary"]
    for key in ("odds.segment", "model.p", "model.interval", "model.coef", "rate.row", "queue.expected"):
        used = {m for line in g[key]["here"] for m in PLACEHOLDER.findall(line)}
        assert used == set(g[key]["vars"]), key


def test_the_runway_entry_reproduces_the_chance():
    s = summary()
    r = s["runway"]
    p, q, n = r["offer_per_application"], r["in_flight_chance"], r["projected_applications"]
    assert 1 - (1 - q) * (1 - p) ** n == pytest.approx(r["chance"])
    assert f"= {r['chance']:.3f}" in s["glossary"]["runway.chance"]["here"][-1]


def test_the_pace_for_eighty_percent_reproduces_its_target():
    s = summary()
    r = s["runway"]
    p, q = r["offer_per_application"], r["in_flight_chance"]
    n = math.log(0.2 / (1 - q)) / math.log(1 - p)
    assert n / r["weeks_left"] == pytest.approx(r["need_per_week"]["80"])


def test_stage_rates_show_the_beta_posterior_mean():
    s = summary()
    reply = next(x for x in s["runway"]["stages"] if x["label"] == "Reply")
    line = s["glossary"]["runway.stage.reply"]["here"][0]
    assert line.startswith(f"({reply['successes']} + 1) / ({reply['trials']} + 1 + 19)")


def test_without_a_deadline_the_runway_entries_are_absent():
    g = summary(deadline=False)["glossary"]
    assert "runway.chance" not in g and "week.target" not in g
    assert "odds.base" in g


def test_build_tolerates_an_empty_summary():
    g = glossary.build({})
    assert "model.p" in g and "calibration" in g
