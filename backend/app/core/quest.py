"""The game: points that track expected interviews, a daily target, weekly quests.

Points for sending are 1000·P(interview) from the odds model (odds.py) at the
moment of sending, so the score rewards what the track record says pays off,
and recalibrates itself as the posteriors move. A send also rolls a draw from
its segments' posteriors; one above all three 95% points is a lucky draw.

The day's target comes from the runway: what is left of the week's target
(the pace for an 80% chance, stats.py), spread over the working days left.

Three quests a week, fixed from the state at Monday 00:00 so they don't shift
mid-week:
  volume   send the week's target
  explore  3 sends in the segment the model is least sure of (widest interval)
  oldest   send or set aside the five drafts that had waited longest

Rewards are idempotent: each is a PointHistory row with a unique reason, and
a send's points are keyed to the application, so un-sending takes them back
and sending again doesn't pay twice.
"""
from __future__ import annotations

import math
import random
from datetime import date, datetime, time, timezone

from app.core import odds
from app.core.stages import is_submitted
from app.models.application import ApplicationStatus as S

SEND_SCALE = 1000
LUCKY_XP = 50
DAY_TARGET_XP = 25
QUEST_XP = {"volume": 100, "explore": 75, "oldest": 50}
DEFAULT_WEEK_TARGET = 20
EXPLORE_SENDS = 3
OLDEST = 5
# Segments too vague to aim at.
VAGUE = {"Unknown", "Unscored"}


def send_xp(p: float | None) -> int:
    return max(1, round(SEND_SCALE * (p or 0)))


def _geomean(xs: list[float]) -> float:
    if not xs or any(x <= 0 for x in xs):
        return 0.0
    return math.exp(sum(math.log(x) for x in xs) / len(xs))


def lucky_roll(model: odds.OddsModel, app, rng: random.Random | None = None) -> tuple[float, float, bool]:
    """A draw from the posteriors of the draft's three segments: (draw, bar, lucky)."""
    rng = rng or random.Random()
    segs = [model.segment(kind, app) or model.base for kind in odds.KEYS]
    if any(s.alpha <= 0 or s.beta <= 0 for s in segs):
        return 0.0, 0.0, False
    draw = _geomean([rng.betavariate(s.alpha, s.beta) for s in segs])
    bar = _geomean([s.hi for s in segs])
    return draw, bar, draw >= bar


def day_target(week_target: int | None, week_sent: int, sent_today: int, working_days_left: int) -> int | None:
    """Today's share of what is left of the week's target (working days left include today)."""
    if week_target is None:
        return None
    remaining = max(0, week_target - (week_sent - sent_today))
    return math.ceil(remaining / max(1, working_days_left))


def _midnight(d: date) -> datetime:
    return datetime.combine(d, time(), tzinfo=timezone.utc)


def _left_shortlist_at(a) -> datetime | None:
    moves = [h.changed_at for h in a.history or [] if h.old_status == S.SHORTLISTED and h.changed_at]
    return min(moves) if moves else None


def weekly_quests(applications: list, week_start: date, week_target: int | None) -> list[dict]:
    sent = [a for a in applications if is_submitted(a) and a.applied_date]
    this_week = [a for a in sent if a.applied_date >= week_start]
    start = _midnight(week_start).replace(tzinfo=None)
    quests = []

    target = week_target or DEFAULT_WEEK_TARGET
    quests.append({
        "key": "volume", "title": f"Send {target} this week",
        "detail": "the pace for an 80% chance of an offer in time" if week_target else "a steady week",
        "progress": len(this_week), "target": target,
    })

    # The model as it stood at Monday 00:00: nothing sent this week is in it.
    before = [a for a in applications if not (is_submitted(a) and a.applied_date and a.applied_date >= week_start)]
    model = odds.odds_model(before, _midnight(week_start))
    pool = [s for s in model.segments if s.name not in VAGUE and s.sent >= 3]
    if pool:
        s = max(pool, key=lambda s: (s.hi - s.lo, -s.sent))
        key = odds.KEYS[s.kind]
        quests.append({
            "key": "explore", "title": f"{EXPLORE_SENDS} sends in {s.kind} · {s.name}",
            "detail": f"the widest interval: {s.lo:.3f}–{s.hi:.3f}, where data teaches most",
            "progress": sum(1 for a in this_week if key(a) == s.name), "target": EXPLORE_SENDS,
        })

    def waiting_at_start(a) -> bool:
        if not a.created_at or a.created_at >= start:
            return False
        left = _left_shortlist_at(a)
        return (a.status == S.SHORTLISTED and left is None) or (left is not None and left >= start)

    oldest = sorted((a for a in applications if waiting_at_start(a)), key=lambda a: a.created_at)[:OLDEST]
    if oldest:
        quests.append({
            "key": "oldest", "title": f"Clear the {len(oldest)} oldest drafts",
            "detail": "send each, or set it aside",
            "progress": sum(1 for a in oldest if a.status != S.SHORTLISTED), "target": len(oldest),
        })

    for q in quests:
        q["done"] = q["progress"] >= q["target"]
        q["xp"] = QUEST_XP[q["key"]]
        q["id"] = f"{week_start.isoformat()}:{q['key']}"
    return quests


def state(applications: list, week_start: date, week_target: int | None, week_sent: int,
          sent_today: int, working_days_left: int, banked: float) -> dict:
    """The game's part of stats.summary()."""
    return {
        "today": {"target": day_target(week_target, week_sent, sent_today, working_days_left), "sent": sent_today},
        "banked": banked,
        "quests": weekly_quests(applications, week_start, week_target),
    }


# --- Awarding (needs a db session) ------------------------------------------

def _paid(db, user, reason: str) -> bool:
    from app.models.point_history import PointHistory
    return db.query(PointHistory.id).filter(PointHistory.user_id == user.id, PointHistory.reason == reason).first() is not None


def _send_points(db, user, app) -> int:
    from sqlalchemy import func
    from app.models.point_history import PointHistory
    total = (db.query(func.coalesce(func.sum(PointHistory.points), 0))
             .filter(PointHistory.user_id == user.id, PointHistory.reference_type == "send",
                     PointHistory.reference_id == app.id).scalar())
    return int(total or 0)


def on_move(db, user, app, old, new, model: odds.OddsModel | None, rng: random.Random | None = None) -> list[tuple[str, str]]:
    """Points for a status move, before the caller commits. Returns news for Friday."""
    from app.core.gamification import add_points

    news: list[tuple[str, str]] = []
    if new == S.APPLIED and old in (S.SHORTLISTED, S.NOT_APPLYING):
        if _send_points(db, user, app) == 0:
            xp = send_xp(app.predicted_p)
            add_points(db, user, xp, f"Sent at P={app.predicted_p or 0:.3f}", "send", app.id)
            if model is not None:
                draw, bar, lucky = lucky_roll(model, app, rng)
                if lucky:
                    add_points(db, user, LUCKY_XP, f"Lucky draw {draw:.3f} ≥ {bar:.3f}", "send", app.id)
                    news.append((f"Lucky draw: +{xp + LUCKY_XP} XP",
                                 f"{app.company_name}: a posterior draw of {draw:.3f}, above the 95% bar {bar:.3f}."))
    elif old == S.APPLIED and new == S.SHORTLISTED:
        paid = _send_points(db, user, app)
        if paid > 0:
            add_points(db, user, -paid, "Unsent", "send", app.id)
    return news


def award(db, user, game: dict, today: date) -> list[tuple[str, str]]:
    """The day's target and finished quests, each paid once. Returns news for Friday."""
    from app.core.gamification import add_points

    news = []
    t = game["today"]
    if t["target"] and t["sent"] >= t["target"]:
        reason = f"Day target {today.isoformat()}"
        if not _paid(db, user, reason):
            add_points(db, user, DAY_TARGET_XP, reason)
            news.append((f"Today's {t['target']} sent: +{DAY_TARGET_XP} XP",
                         f"{game['banked']:.2f} interviews expected from what is in flight."))
    for q in game["quests"]:
        if q["done"]:
            reason = f"Quest {q['id']}"
            if not _paid(db, user, reason):
                add_points(db, user, q["xp"], reason)
                news.append((f"Quest done: {q['title']}", f"+{q['xp']} XP"))
    return news
