"""Runway: the frontend's utils/runway.ts, for the server.

Given the search deadline and the funnel's real conversion rates: how likely
is an offer in time, and what pace would it take? The Dashboard's Runway card
computes this in the browser; Friday and the nudges need the same numbers from
here. This mirrors the TypeScript one for one, and tests/test_runway.py mirrors
frontend/src/__tests__/runway.test.ts. Change both together.

Each stage rate is (successes + a) / (trials + a + b): the observed rate,
pulled gently towards a prior, so a stage with no outcomes yet reads as an
assumption rather than "never".
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone

from app.core.stages import has_positive_response, has_reached_interview, has_reached_offer, is_submitted
from app.models.application import ApplicationStatus as S

PRIORS = {
    "reply": {"a": 1, "b": 19, "note": "about 1 in 20"},
    "interview": {"a": 1, "b": 1, "note": "about 1 in 2"},
    "offer": {"a": 1, "b": 4, "note": "about 1 in 5"},
}

DAY = timedelta(days=1)
WEEK = timedelta(days=7)
PACE_WINDOW_DAYS = 28
INTERVIEW_STAGES = [S.PHONE_SCREEN, S.TECHNICAL_ROUND_1, S.TECHNICAL_ROUND_2, S.FINAL_ROUND]


@dataclass
class Stage:
    label: str
    successes: int
    trials: int
    rate: float
    prior_note: str
    # True while the prior outweighs the data.
    assumed: bool

    def as_dict(self) -> dict:
        return {"label": self.label, "successes": self.successes, "trials": self.trials,
                "rate": self.rate, "prior_note": self.prior_note, "assumed": self.assumed}


@dataclass
class Runway:
    offer_by: datetime
    last_apply_by: datetime
    weeks_left: float
    stages: list[Stage] = field(default_factory=list)
    offer_per_application: float = 0.0
    applications_per_offer: float = math.inf
    pace_per_week: float = 0.0
    in_flight: int = 0
    in_flight_chance: float = 0.0
    projected_applications: float = 0.0
    chance: float = 0.0

    def pace_for(self, target: float) -> float:
        return pace_for(target, self.offer_per_application, self.weeks_left, self.in_flight_chance)


def _stage(label: str, successes: int, trials: int, prior: dict) -> Stage:
    return Stage(label, successes, trials,
                 (successes + prior["a"]) / (trials + prior["a"] + prior["b"]),
                 prior["note"], trials < prior["a"] + prior["b"])


def chance_of_offer(per_application: float, n: float, in_flight_chance: float) -> float:
    """Chance that n further applications, plus what is in flight, bring at least one offer."""
    return 1 - (1 - in_flight_chance) * (1 - per_application) ** max(0.0, n)


def pace_for(target: float, per_application: float, weeks: float, in_flight_chance: float) -> float:
    """Applications per week needed to reach `target` chance in `weeks`."""
    if in_flight_chance >= target:
        return 0.0
    if weeks <= 0 or per_application <= 0:
        return math.inf
    n = math.log((1 - target) / (1 - in_flight_chance)) / math.log(1 - per_application)
    return n / weeks


def _midnight(d: date) -> datetime:
    # As `new Date('YYYY-MM-DD')` in the browser: midnight UTC.
    return datetime.combine(d, time(), tzinfo=timezone.utc)


def compute_runway(applications, deadline: date, hiring_weeks: int, paperwork_weeks: int,
                   now: datetime | None = None, reply_multiplier: float = 1.0) -> Runway:
    now = now or datetime.now(timezone.utc)
    sent = [a for a in applications if is_submitted(a)]
    replied = [a for a in sent if has_positive_response(a)]
    interviewed = [a for a in sent if has_reached_interview(a)]
    offered = [a for a in sent if has_reached_offer(a)]

    reply = _stage("Reply", len(replied), len(sent), PRIORS["reply"])
    reply.rate = min(1.0, reply.rate * reply_multiplier)
    interview = _stage("Interview", len(interviewed), len(replied), PRIORS["interview"])
    offer = _stage("Offer", len(offered), len(interviewed), PRIORS["offer"])
    per_application = reply.rate * interview.rate * offer.rate

    offer_by = _midnight(deadline) - paperwork_weeks * WEEK
    last_apply_by = offer_by - hiring_weeks * WEEK
    weeks_left = max(0.0, (last_apply_by - now) / WEEK)

    pace_start = now - PACE_WINDOW_DAYS * DAY
    recent = sum(1 for a in sent if a.applied_date and _midnight(a.applied_date) >= pace_start)
    pace_per_week = recent / (PACE_WINDOW_DAYS / 7)

    # Live applications still have a shot, weighted by how far they got. One
    # unanswered for longer than the hiring window counts as done.
    hiring_start = now - hiring_weeks * WEEK

    def live(a) -> bool:
        if a.status == S.APPLIED:
            return bool(a.applied_date) and _midnight(a.applied_date) >= hiring_start
        return a.status == S.REPLIED or a.status in INTERVIEW_STAGES

    def live_chance(a) -> float:
        if a.status == S.APPLIED:
            return per_application
        if a.status == S.REPLIED:
            return interview.rate * offer.rate
        return offer.rate

    alive = [a for a in sent if live(a)]
    miss = 1.0
    for a in alive:
        miss *= 1 - live_chance(a)
    in_flight_chance = 1 - miss

    projected = pace_per_week * weeks_left
    return Runway(
        offer_by=offer_by,
        last_apply_by=last_apply_by,
        weeks_left=weeks_left,
        stages=[reply, interview, offer],
        offer_per_application=per_application,
        applications_per_offer=1 / per_application if per_application > 0 else math.inf,
        pace_per_week=pace_per_week,
        in_flight=len(alive),
        in_flight_chance=in_flight_chance,
        projected_applications=projected,
        chance=chance_of_offer(per_application, projected, in_flight_chance),
    )

