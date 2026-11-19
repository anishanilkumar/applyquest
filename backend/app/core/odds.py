"""P(interview): a Beta-Binomial model of the track record, for the server.

The frontend's utils/odds.ts computes the same model in the browser for the
apply queue; this mirrors it one for one, and tests/test_odds.py mirrors
frontend/src/__tests__/odds.test.ts. Change both together. Calibration (how
well past predictions did) lives only here, since only the server stores the
prediction made when an application was sent (`Application.predicted_p`).

The model, per segment s (effort tier, role type, fit band):

    p_s ~ Beta(K·p0, K·(1 - p0))                    prior: K applications' worth of p0
    p_s | data ~ Beta(K·p0 + Σ w·y, K·(1 - p0) + Σ w·f)

y is 1 for an application that reached an interview. f is its failure weight:
1 for one closed without an interview (Rejected, Ghosted), and G(t) for one
still waiting, t days after it was sent. G is the share of positive replies
that arrive within t days, so a week-old application counts as only part of a
"no": most of its chance of a reply is still ahead of it. Without this, every
big batch would drag the rate down until its replies came in.

G is the empirical distribution of reply delays, blended with a linear ramp
over HORIZON_DAYS worth G_PRIOR observations, so a handful of replies doesn't
decide it alone.

w = DECAY ** (weeks since sent) lets old evidence fade as the market moves.
p0 is the overall rate with the same weights. A draft's P is the geometric
mean of its three segment means: a ranking heuristic, not a joint model.
"""
from __future__ import annotations

import math
from bisect import bisect_right
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

from app.core.stages import POSITIVE, has_positive_response, has_reached_interview, is_submitted
from app.models.application import ApplicationStatus as S

K = 10
DECAY = 0.98
HORIZON_DAYS = 42
G_PRIOR = 5
CREDIBLE = 0.9
PENDING = {S.APPLIED, S.REPLIED}


def fit_band(score: int | None) -> str:
    """The verdict bands of ai-job-search's job evaluation, as outcome_stats uses them."""
    if score is None:
        return "Unscored"
    if score >= 75:
        return "Strong (75+)"
    if score >= 60:
        return "Good (60-74)"
    if score >= 45:
        return "Moderate (45-59)"
    return "Weak (<45)"


def _value(x) -> str | None:
    return getattr(x, "value", x)


# getattr: the summary and the status endpoint also see bare test doubles.
KEYS = {
    "Tier": lambda a: _value(getattr(a, "effort", None)) or "Unknown",
    "Role": lambda a: getattr(a, "role_type", None) or "Unknown",
    "Fit": lambda a: fit_band(getattr(a, "fit_score", None)),
}


def _predicted(a) -> float | None:
    return getattr(a, "predicted_p", None)


# --- The Beta distribution's quantile, without scipy -------------------------

def _betacf(a: float, b: float, x: float) -> float:
    """Continued fraction for the incomplete beta function (modified Lentz)."""
    tiny = 1e-300
    qab, qap, qam = a + b, a + 1, a - 1
    c, d = 1.0, 1 - qab * x / qap
    d = 1 / (d if abs(d) > tiny else tiny)
    h = d
    for m in range(1, 300):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1 + aa * d
        d = 1 / (d if abs(d) > tiny else tiny)
        c = 1 + aa / c
        c = c if abs(c) > tiny else tiny
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1 + aa * d
        d = 1 / (d if abs(d) > tiny else tiny)
        c = 1 + aa / c
        c = c if abs(c) > tiny else tiny
        delta = d * c
        h *= delta
        if abs(delta - 1) < 1e-12:
            break
    return h


def beta_cdf(x: float, a: float, b: float) -> float:
    """The regularized incomplete beta function I_x(a, b)."""
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    ln = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log(1 - x)
    front = math.exp(ln)
    if x < (a + 1) / (a + b + 2):
        return front * _betacf(a, b, x) / a
    return 1 - front * _betacf(b, a, 1 - x) / b


def beta_quantile(q: float, a: float, b: float) -> float:
    lo, hi = 0.0, 1.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if beta_cdf(mid, a, b) < q:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


# --- Reply delays and the censoring weight -----------------------------------

def _day(naive_utc: datetime) -> date:
    return naive_utc.replace(tzinfo=timezone.utc).date()


def reply_delays(sent: list) -> list[int]:
    """Days from sending to the first positive reply, for each application that got one."""
    out = []
    for a in sent:
        if not a.applied_date:
            continue
        hits = [h.changed_at for h in a.history or [] if h.new_status in POSITIVE and h.changed_at]
        if hits and has_positive_response(a):
            out.append(max(0, (_day(min(hits)) - a.applied_date).days))
    return sorted(out)


@dataclass
class Waiting:
    """G(t): the share of positive replies that have arrived t days after sending."""
    delays: list[int]

    def __call__(self, t: float) -> float:
        ramp = min(1.0, max(0.0, t / HORIZON_DAYS))
        m = len(self.delays)
        seen = bisect_right(self.delays, t) / m if m else 0.0
        return (m * seen + G_PRIOR * ramp) / (m + G_PRIOR)


# --- The model ---------------------------------------------------------------

@dataclass
class Segment:
    kind: str
    name: str
    interviews: int
    sent: int
    alpha: float
    beta: float
    p: float
    lo: float
    hi: float

    def as_dict(self) -> dict:
        return {k: getattr(self, k) for k in ("kind", "name", "interviews", "sent", "alpha", "beta", "p", "lo", "hi")}


def _interval(a: float, b: float) -> tuple[float, float]:
    if a <= 0 or b <= 0:
        return 0.0, 0.0
    tail = (1 - CREDIBLE) / 2
    return beta_quantile(tail, a, b), beta_quantile(1 - tail, a, b)


@dataclass
class Evidence:
    app: object
    y: int
    f: float
    w: float
    age_days: int


@dataclass
class OddsModel:
    base: Segment
    segments: list[Segment] = field(default_factory=list)
    waiting: Waiting = field(default_factory=lambda: Waiting([]))
    evidence: list[Evidence] = field(default_factory=list)

    def segment(self, kind: str, app) -> Segment | None:
        name = KEYS[kind](app)
        return next((s for s in self.segments if s.kind == kind and s.name == name), None)

    def p(self, app) -> float:
        parts = [(self.segment(kind, app) or self.base).p for kind in KEYS]
        if any(x <= 0 for x in parts):
            return 0.0
        return math.exp(sum(math.log(x) for x in parts) / len(parts))

    def still_alive(self, p: float, age_days: float) -> float:
        """P(interview | no reply yet after age_days), by Bayes' rule on G."""
        g = self.waiting(age_days)
        return p * (1 - g) / (1 - p * g) if p * g < 1 else 0.0


def _evidence(sent: list, waiting: Waiting, today: date) -> list[Evidence]:
    out = []
    for a in sent:
        age = max(0, (today - a.applied_date).days) if a.applied_date else 0
        w = DECAY ** (age / 7)
        if has_reached_interview(a):
            out.append(Evidence(a, 1, 0.0, w, age))
        elif a.status in PENDING:
            out.append(Evidence(a, 0, waiting(age), w, age))
        else:
            out.append(Evidence(a, 0, 1.0, w, age))
    return out


def odds_model(applications: list, now: datetime | None = None) -> OddsModel:
    today = (now or datetime.now(timezone.utc)).date()
    sent = [a for a in applications if is_submitted(a)]
    waiting = Waiting(reply_delays(sent))
    ev = _evidence(sent, waiting, today)

    succ = sum(e.w * e.y for e in ev)
    trials = sum(e.w * (e.y + e.f) for e in ev)
    p0 = succ / trials if trials else 0.0

    def segment(kind: str, name: str, rows: list[Evidence]) -> Segment:
        a = K * p0 + sum(e.w * e.y for e in rows)
        b = K * (1 - p0) + sum(e.w * e.f for e in rows)
        p = a / (a + b) if a > 0 else 0.0
        lo, hi = _interval(a, b)
        return Segment(kind, name, sum(e.y for e in rows), len(rows), a, b, p, lo, hi)

    base = segment("All", "All", ev)
    groups: dict[tuple[str, str], list[Evidence]] = {}
    for kind, key in KEYS.items():
        for e in ev:
            groups.setdefault((kind, key(e.app)), []).append(e)
    segments = [segment(kind, name, rows) for (kind, name), rows in groups.items()]
    segments.sort(key=lambda s: (s.kind, -s.sent))
    return OddsModel(base, segments, waiting, ev)


def calibration(model: OddsModel) -> dict:
    """How the predictions stored at sending compare with what happened.

    Only settled applications count: reached an interview, or closed without
    one. Brier = mean (p - y)²; always guessing the base rate scores p0(1 - p0).
    """
    rows = [(_predicted(e.app), e.y) for e in model.evidence
            if _predicted(e.app) is not None and (e.y == 1 or e.f == 1.0)]
    n = len(rows)
    return {
        "n": n,
        "expected": sum(p for p, _ in rows),
        "observed": sum(y for _, y in rows),
        "brier": sum((p - y) ** 2 for p, y in rows) / n if n else None,
    }


def in_flight(model: OddsModel) -> float:
    """Interviews still expected from applications waiting for a reply."""
    total = 0.0
    for e in model.evidence:
        if e.app.status == S.APPLIED:
            p = _predicted(e.app)
            p = p if p is not None else model.p(e.app)
            total += model.still_alive(p, e.age_days)
    return total


def summary(applications: list, now: datetime | None = None) -> dict:
    m = odds_model(applications, now)
    return {
        "base": m.base.as_dict(),
        "segments": [s.as_dict() for s in m.segments],
        "reply_delays": len(m.waiting.delays),
        "in_flight_expected": in_flight(m),
        "calibration": calibration(m),
    }
