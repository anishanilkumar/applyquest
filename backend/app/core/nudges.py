"""What the nudges say, from a stats.summary(). Pure, so they can be tested.

The scheduler (scheduler.py) decides when; friday.py sends them. Each returns
(title, body), or None when there is nothing worth saying.
"""
from __future__ import annotations

from datetime import date

from app.models.application import ApplicationStatus as S


def _day(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d.day} {d.strftime('%b')}"


def _plural(n: int, one: str, many: str | None = None) -> str:
    return f"{n} {one if n == 1 else (many or one + 's')}"


def _week_line(s: dict) -> str:
    w = s["week"]
    if w["target"]:
        return f"This week: {w['sent']} of {w['target']}."
    return f"This week: {w['sent']} sent."


def evening(s: dict) -> tuple[str, str] | None:
    """8 PM on a working day with nothing sent."""
    t = s["today"]
    if not t["working"] or t["sent"] > 0:
        return None
    streak = s["streak"]["current"]
    if streak >= 2 and not t["active"]:
        title = f"Your {streak}-day streak ends tonight"
    else:
        title = "No application sent today"
    sl = s["shortlist"]
    if sl["count"]:
        oldest = sl["oldest"][0]["days"] if sl["oldest"] else 0
        waiting = f"{_plural(sl['count'], 'shortlisted job')} waiting"
        waiting += f", the oldest for {_plural(oldest, 'day')}." if oldest >= 2 else "."
    else:
        waiting = "The shortlist is empty: one good find is a start."
    return title, f"{waiting} {_week_line(s)}"


def weekly(s: dict) -> tuple[str, str]:
    """Monday morning: last week against the target, and the runway."""
    last = s["weeks"][-2]["sent"] if len(s["weeks"]) >= 2 else 0
    target = s["week"]["target"]
    title = f"Last week: {last} sent" + (f", target {target}" if target else "")
    r = s["runway"]
    if not r:
        return title, "Set a search deadline on ApplyQuest's Dashboard to see the runway."
    if r["weeks_left"] <= 0:
        return title, f"The last useful day to apply ({_day(r['last_apply_by'])}) has passed; what is in flight counts now."
    chance = round(r["chance"] * 100)
    body = f"At {r['pace_per_week']:.1f} a week, the chance of an offer by {_day(r['offer_by'])} is {chance}%."
    need = r["need_per_week"].get("80")
    if need is not None and r["chance"] < 0.8:
        body += f" {max(1, round(need + 0.49))} a week gets it to 80%."
    if r["weeks_left"] < 3:
        body += f" Last useful day to apply: {_day(r['last_apply_by'])}."
    return title, body


def good_news(status: S, company: str, title: str) -> tuple[str, str] | None:
    """A reply, an interview round or an offer, as it is recorded."""
    if status == S.REPLIED:
        return f"{company} replied", title
    if status == S.OFFER:
        return f"Offer from {company}", title
    if status in (S.PHONE_SCREEN, S.TECHNICAL_ROUND_1, S.TECHNICAL_ROUND_2, S.FINAL_ROUND):
        return f"{status.value}: {company}", title
    return None
