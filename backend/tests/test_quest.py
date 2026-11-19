import random
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.core import quest
from app.core.gamification import FREEZE_CAP, LEVELS, add_points, next_level
from app.core.nudges import evening, midday
from app.core.odds import odds_model
from app.models.application import ApplicationStatus as S

MONDAY = date(2026, 11, 16)
NOW = datetime(2026, 11, 19, 12, tzinfo=timezone.utc)
START = datetime(2026, 11, 16)

n = 0


def app(status, effort="Full", role="Backend", fit=80, applied=None, created=None, path=(), left=None):
    """left: when it left Shortlisted (naive UTC), for a draft sent or set aside."""
    global n
    n += 1
    history = []
    if path:
        at = left or datetime(2026, 10, 1)
        history = [SimpleNamespace(old_status=path[i], new_status=s, changed_at=at + timedelta(hours=i))
                   for i, s in enumerate(path[1:])]
    return SimpleNamespace(id=f"a{n}", status=status, effort=effort, role_type=role, fit_score=fit,
                           applied_date=applied, created_at=created or datetime(2026, 10, 1),
                           history=history, predicted_p=None, company_name=f"Co{n}")


SENT = (S.SHORTLISTED, S.APPLIED)
REJ = (S.SHORTLISTED, S.APPLIED, S.REJECTED)
INT = (S.SHORTLISTED, S.APPLIED, S.REPLIED, S.PHONE_SCREEN)


def record():
    old = date(2026, 10, 1)
    return ([app(S.PHONE_SCREEN, applied=old, path=INT)]
            + [app(S.REJECTED, applied=old, path=REJ) for _ in range(5)]
            + [app(S.REJECTED, "Generic", "AI/ML", 50, applied=old, path=REJ) for _ in range(6)])


def test_send_xp_is_a_thousand_times_p():
    assert quest.send_xp(0.0534) == 53
    assert quest.send_xp(0.0001) == 1
    assert quest.send_xp(None) == 1


def test_day_target_spreads_what_is_left_of_the_week():
    assert quest.day_target(40, week_sent=12, sent_today=2, working_days_left=3) == 10
    assert quest.day_target(40, week_sent=45, sent_today=5, working_days_left=2) == 0
    assert quest.day_target(None, 3, 1, 2) is None
    assert quest.day_target(10, 0, 0, 0) == 10


def test_a_lucky_draw_is_rare():
    m = odds_model(record(), NOW)
    rng = random.Random(1)
    draft = app(S.SHORTLISTED)
    hits = sum(quest.lucky_roll(m, draft, rng)[2] for _ in range(4000))
    # Above all three 95% points at once: well under one in twenty.
    assert 0 < hits / 4000 < 0.05


def test_quests_are_fixed_from_monday_and_count_this_weeks_sends():
    apps = record() + [
        app(S.APPLIED, applied=date(2026, 11, 17), path=SENT, left=datetime(2026, 11, 17)),
        app(S.APPLIED, "Generic", "AI/ML", 50, applied=date(2026, 11, 18), path=SENT, left=datetime(2026, 11, 18)),
    ]
    qs = {q["key"]: q for q in quest.weekly_quests(apps, MONDAY, 30)}
    assert qs["volume"]["progress"] == 2 and qs["volume"]["target"] == 30 and not qs["volume"]["done"]
    explore = qs["explore"]
    assert explore["target"] == quest.EXPLORE_SENDS
    assert explore["id"] == "2026-11-16:explore"
    # This week's sends don't move the model the quest was picked from.
    again = {q["key"]: q for q in quest.weekly_quests(apps + [app(S.PHONE_SCREEN, applied=date(2026, 11, 18), path=INT)], MONDAY, 30)}
    assert again["explore"]["title"] == explore["title"]


def test_oldest_quest_counts_drafts_waiting_on_monday():
    early = datetime(2026, 9, 1)
    waiting = [app(S.SHORTLISTED, created=early + timedelta(days=i)) for i in range(6)]
    sent_this_week = app(S.APPLIED, created=early - timedelta(days=1), applied=date(2026, 11, 17), path=SENT,
                         left=datetime(2026, 11, 17))
    set_aside_before = app(S.NOT_APPLYING, created=early - timedelta(days=2), path=(S.SHORTLISTED, S.NOT_APPLYING),
                           left=datetime(2026, 11, 10))
    new_draft = app(S.SHORTLISTED, created=datetime(2026, 11, 18))
    qs = {q["key"]: q for q in quest.weekly_quests([*waiting, sent_this_week, set_aside_before, new_draft], MONDAY, None)}
    oldest = qs["oldest"]
    assert oldest["target"] == 5
    assert oldest["progress"] == 1
    assert qs["volume"]["target"] == quest.DEFAULT_WEEK_TARGET


def test_state_bundles_today_banked_and_quests():
    g = quest.state(record(), MONDAY, 40, 12, 2, 3, 0.8)
    assert g["today"] == {"target": 10, "sent": 2}
    assert g["banked"] == 0.8
    assert len(g["quests"]) >= 2


# --- Awarding ----------------------------------------------------------------

def db_with(paid_reasons=(), send_points=0):
    db = MagicMock()

    def query(*cols):
        q = MagicMock()
        q.filter.return_value.scalar.return_value = send_points
        q.filter.return_value.first.side_effect = lambda: None
        return q
    db.query.side_effect = query
    return db


@patch("app.core.gamification.add_points")
def test_a_send_pays_its_expected_interviews_once(add):
    a = app(S.APPLIED)
    a.predicted_p = 0.042
    quest.on_move(db_with(send_points=0), SimpleNamespace(id="u"), a, S.SHORTLISTED, S.APPLIED, None)
    add.assert_called_once()
    assert add.call_args.args[2] == 42
    add.reset_mock()
    quest.on_move(db_with(send_points=42), SimpleNamespace(id="u"), a, S.NOT_APPLYING, S.APPLIED, None)
    add.assert_not_called()


@patch("app.core.gamification.add_points")
def test_unsending_takes_the_points_back(add):
    quest.on_move(db_with(send_points=92), SimpleNamespace(id="u"), app(S.SHORTLISTED), S.APPLIED, S.SHORTLISTED, None)
    assert add.call_args.args[2] == -92


@patch("app.core.gamification.add_points")
def test_award_pays_the_day_target_and_finished_quests_once(add):
    game = {"today": {"target": 3, "sent": 3}, "banked": 0.5, "quests": [
        {"id": "2026-11-16:volume", "title": "Send 20 this week", "done": True, "xp": 100},
        {"id": "2026-11-16:explore", "title": "x", "done": False, "xp": 75}]}
    with patch.object(quest, "_paid", return_value=False):
        news = quest.award(MagicMock(), SimpleNamespace(id="u"), game, date(2026, 11, 19))
    assert [c.args[2] for c in add.call_args_list] == [quest.DAY_TARGET_XP, 100]
    assert len(news) == 2
    add.reset_mock()
    with patch.object(quest, "_paid", return_value=True):
        assert quest.award(MagicMock(), SimpleNamespace(id="u"), game, date(2026, 11, 19)) == []
    add.assert_not_called()


# --- Streak freezes and levels -----------------------------------------------

def run(user, today):
    mock_dt = MagicMock()
    mock_dt.now.return_value = today
    with patch("app.core.gamification.datetime", mock_dt), \
         patch("app.core.gamification.load_off_days", return_value=set()):
        add_points(MagicMock(), user, points=1, reason="test")


def user(streak, last, freezes=0):
    return SimpleNamespace(id=None, current_streak=streak, longest_streak=streak, updated_at=last,
                           level=1, level_name="Novice Seeker", points=0, point_history=[], streak_freezes=freezes)


def test_a_freeze_covers_a_missed_working_day():
    u = user(6, datetime(2026, 11, 17, 10), freezes=1)  # Tuesday; Wednesday missed
    run(u, datetime(2026, 11, 19, 10, tzinfo=timezone.utc))
    assert (u.current_streak, u.streak_freezes) == (7, 0)


def test_two_missed_days_need_two_freezes():
    u = user(6, datetime(2026, 11, 16, 10), freezes=1)  # Monday; Tue and Wed missed
    run(u, datetime(2026, 11, 19, 10, tzinfo=timezone.utc))
    assert (u.current_streak, u.streak_freezes) == (1, 1)


def test_every_fifth_day_earns_a_freeze_up_to_the_cap():
    u = user(4, datetime(2026, 11, 18, 10), freezes=FREEZE_CAP)
    run(u, datetime(2026, 11, 19, 10, tzinfo=timezone.utc))
    assert (u.current_streak, u.streak_freezes) == (5, FREEZE_CAP)
    u = user(9, datetime(2026, 11, 18, 10))
    run(u, datetime(2026, 11, 19, 10, tzinfo=timezone.utc))
    assert u.streak_freezes == 1


def test_the_ladder_runs_to_ten():
    assert LEVELS[-1]["level"] == 10
    assert next_level(1600)["name"] == "Pipeline Builder"
    assert next_level(99999) is None


# --- Nudges --------------------------------------------------------------------

def summary(sent=1, target=6, working=True, freezes=0, streak=5, active=False):
    return {"today": {"working": working, "sent": sent, "active": active},
            "streak": {"current": streak, "freezes": freezes},
            "shortlist": {"count": 0, "oldest": []}, "week": {"sent": 3, "target": 30},
            "game": {"today": {"target": target, "sent": sent}, "banked": 1.234,
                     "quests": [{"title": "Send 30 this week", "progress": 3, "target": 30, "done": False}]}}


def test_midday_nudge_when_behind_today():
    title, body = midday(summary())
    assert title == "1 of 6 sent today"
    assert "5 more" in body and "1.23 interviews" in body and "Send 30 this week (3/30)" in body
    assert midday(summary(sent=6)) is None
    assert midday(summary(working=False)) is None
    assert midday(summary(target=None)) is None


def test_evening_nudge_says_a_freeze_will_cover_today():
    title, _ = evening(summary(sent=0, freezes=1))
    assert title == "A freeze will cover today (1 left)"
