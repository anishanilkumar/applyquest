"""The job search at a glance, for Friday's ApplyQuest section and its nudges.

One read-only summary: the runway (runway.py), applications per week against
the pace it asks for, the funnel, what gets replies, the streak, the
shortlist still waiting, the next interviews, the odds model's posteriors
and calibration (odds.py), and the game: today's target, the interviews banked
and the week's quests (quest.py). Every count uses the same
definitions as the Dashboard and Analytics (stages.py). Dates are Berlin's,
as the streak's are.
"""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.core import odds, quest
from app.core.gamification import next_level
from app.core.runway import compute_runway
from app.core.stages import has_positive_response, has_reached_interview, has_reached_offer, is_submitted
from app.core.working_days import _is_off_day
from app.models.application import ApplicationStatus as S

BERLIN = ZoneInfo("Europe/Berlin")
WEEKS = 12
DAYS = 35
# The chance the weekly target aims for.
TARGET_CHANCE = 0.8
INTERVIEW_STAGES = {S.PHONE_SCREEN, S.TECHNICAL_ROUND_1, S.TECHNICAL_ROUND_2, S.FINAL_ROUND}
GOOD_NEWS = INTERVIEW_STAGES | {S.REPLIED, S.OFFER}


def berlin_date(naive_utc: datetime | None) -> date | None:
    if naive_utc is None:
        return None
    return naive_utc.replace(tzinfo=timezone.utc).astimezone(BERLIN).date()


def _finite(x: float) -> float | None:
    return x if math.isfinite(x) else None


def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _rates(groups: dict[str, list]) -> list[dict]:
    out = [{"name": k, "sent": len(v), "replied": sum(1 for a in v if has_positive_response(a))}
           for k, v in groups.items()]
    return sorted(out, key=lambda g: -g["sent"])[:6]


def _drivers(sent: list) -> dict:
    by: dict[str, dict[str, list]] = {"source": {}, "effort": {}, "cover_letter": {}}
    for a in sent:
        by["source"].setdefault(a.job_board_source or "Unknown", []).append(a)
        effort = getattr(a.effort, "value", a.effort) or "Unknown"
        by["effort"].setdefault(effort, []).append(a)
        by["cover_letter"].setdefault("Cover letter" if a.cover_letter_file else "No cover letter", []).append(a)
    return {k: _rates(v) for k, v in by.items()}


def summary(user, applications: list, interviews: list, off_days: set[date], now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(BERLIN).date()
    sent = [a for a in applications if is_submitted(a)]
    drafts = [a for a in applications if a.status == S.SHORTLISTED]

    per_day: dict[date, int] = {}
    for a in sent:
        if a.applied_date:
            per_day[a.applied_date] = per_day.get(a.applied_date, 0) + 1

    this_week = _week_start(today)
    weeks = []
    for i in range(WEEKS - 1, -1, -1):
        start = this_week - timedelta(weeks=i)
        weeks.append({"start": start.isoformat(),
                      "sent": sum(n for d, n in per_day.items() if start <= d < start + timedelta(days=7))})
    days = [{"date": (d := today - timedelta(days=i)).isoformat(), "sent": per_day.get(d, 0),
             "off": _is_off_day(d, off_days)} for i in range(DAYS - 1, -1, -1)]

    runway = None
    target = None
    if user.search_deadline:
        r = compute_runway(applications, user.search_deadline, user.hiring_weeks, user.paperwork_weeks, now)
        need = {str(int(t * 100)): _finite(r.pace_for(t)) for t in (0.5, 0.8, 0.9)}
        target = need["80"]
        runway = {
            "deadline": user.search_deadline.isoformat(),
            "offer_by": r.offer_by.date().isoformat(),
            "last_apply_by": r.last_apply_by.date().isoformat(),
            "weeks_left": r.weeks_left,
            "pace_per_week": r.pace_per_week,
            "chance": r.chance,
            "need_per_week": need,
            "in_flight": r.in_flight,
            "applications_per_offer": _finite(r.applications_per_offer),
            "stages": [s.as_dict() for s in r.stages],
        }

    week_sent = weeks[-1]["sent"]
    working_left = sum(1 for i in range(7 - today.weekday())
                       if not _is_off_day(today + timedelta(days=i), off_days))

    waiting = sorted(drafts, key=lambda a: a.created_at or datetime.min)
    upcoming = sorted((i for i in interviews if i.starts_at and i.starts_at >= now), key=lambda i: i.starts_at)[:5]

    odds_block = odds.summary(applications, now)
    week_target = math.ceil(target) if target is not None else None
    game = quest.state(applications, this_week, week_target, week_sent, per_day.get(today, 0),
                       working_left, odds_block["in_flight_expected"])

    recent = []
    since = now.replace(tzinfo=None) - timedelta(days=14)
    for a in applications:
        for h in a.history or []:
            if h.new_status in GOOD_NEWS and h.changed_at and h.changed_at >= since:
                recent.append((h.changed_at, a, h.new_status))
    recent.sort(key=lambda t: t[0], reverse=True)

    return {
        "now": now.isoformat(),
        "today": {
            "date": today.isoformat(),
            "working": not _is_off_day(today, off_days),
            "sent": per_day.get(today, 0),
            "active": berlin_date(user.updated_at) == today,
        },
        "streak": {"current": user.current_streak, "longest": user.longest_streak,
                   "freezes": getattr(user, "streak_freezes", 0) or 0,
                   "level": user.level, "level_name": user.level_name, "points": user.points,
                   "next_level": next_level(user.points)},
        "week": {"start": this_week.isoformat(), "sent": week_sent,
                 "target": week_target,
                 "target_chance": TARGET_CHANCE, "working_days_left": working_left},
        "weeks": weeks,
        "days": days,
        "runway": runway,
        "funnel": {
            "sent": len(sent),
            "replied": sum(1 for a in sent if has_positive_response(a)),
            "interviewed": sum(1 for a in sent if has_reached_interview(a)),
            "offered": sum(1 for a in sent if has_reached_offer(a)),
            "active": sum(1 for a in sent if a.status not in (S.REJECTED, S.GHOSTED, S.OFFER)),
            "drafts": len(drafts),
        },
        "drivers": _drivers(sent),
        "odds": odds_block,
        "game": game,
        "shortlist": {
            "count": len(drafts),
            "oldest": [{
                "id": str(a.id), "company": a.company_name, "title": a.position_title,
                "days": (today - (berlin_date(a.created_at) or today)).days,
                "url": a.job_url, "priority": a.priority_stars or 0,
            } for a in waiting[:5]],
        },
        "interviews": [{
            "company": i.application.company_name if i.application else "",
            "title": i.application.position_title if i.application else "",
            "stage": i.stage or i.title or "",
            "starts_at": i.starts_at.isoformat(),
        } for i in upcoming],
        "recent": [{"company": a.company_name, "title": a.position_title, "status": st.value,
                    "at": at.replace(tzinfo=timezone.utc).isoformat()} for at, a, st in recent[:5]],
    }
