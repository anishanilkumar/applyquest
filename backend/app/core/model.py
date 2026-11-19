"""P(interview) as one Bayesian logistic regression, with partial pooling.

odds.py rates each segment (effort, role type, fit band) on its own and takes
the geometric mean of three, which double-counts what the segments share: a
Full application is also more often a Fullstack one with a cover letter.
Here every factor sits in one linear predictor, so each gets the effect that
is left once the others are accounted for:

    logit p_i = b0 + Σ_g b[g, level_g(i)]
    b0 ~ N(logit p0, 2²),   b[g, ·] ~ N(0, σ²)

with groups g = effort, role, fit band, cover letter, source. σ is how far a
level may stray from the average: picked from a grid by the Laplace
approximation to the marginal likelihood, so the data decides how much to
shrink. The likelihood is odds.py's evidence: y = 1 for an interview, a
failure weight f (1 when closed, G(t) while waiting) and the decay weight w:

    log L = Σ w·[y·log p + f·log(1 − p)]

The posterior is approximated by a normal at its mode (Newton's method),
N(β̂, H⁻¹). A draft's P is E[σ(xβ)] by the probit approximation
σ(μ / √(1 + π s²/8)), with μ = xβ̂ and s² = xᵀH⁻¹x; its 90% interval is
σ(μ ± 1.645 s). A Thompson draw takes one β from the posterior and scores
every draft with it, so ranking by the draws sends some applications where
the model is unsure, which is where the next result teaches most.

Pure Python (no numpy on the server): about 30 coefficients and a few
hundred applications. The fit is cached until the applications change.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass

from app.core import odds

SIGMAS = (0.25, 0.5, 1.0, 2.0)
INTERCEPT_SD = 2.0
Z90 = 1.6448536269514722
NEWTON_STEPS = 50


def source_group(source: str | None) -> str:
    s = (source or "").lower()
    if "linkedin" in s:
        return "LinkedIn"
    if "email" in s:
        return "Email"
    if any(k in s for k in ("ashby", "greenhouse", "lever", "personio", "teamtailor", "smartrecruiters",
                             "workable", "join", "recruitee", "factorial", "successfactors", "oracle")):
        return "ATS"
    if "company" in s or "career" in s:
        return "Company site"
    return "Other"


GROUPS = {
    "Tier": odds.KEYS["Tier"],
    "Role": odds.KEYS["Role"],
    "Fit": odds.KEYS["Fit"],
    "Cover letter": lambda a: "Yes" if getattr(a, "cover_letter_file", None) else "No",
    "Source": lambda a: source_group(getattr(a, "job_board_source", None)),
}


def features(app) -> list[str]:
    return [f"{g}={key(app)}" for g, key in GROUPS.items()]


def _sigmoid(x: float) -> float:
    if x >= 0:
        return 1 / (1 + math.exp(-x))
    e = math.exp(x)
    return e / (1 + e)


def _logit(p: float) -> float:
    p = min(max(p, 1e-6), 1 - 1e-6)
    return math.log(p / (1 - p))


# --- Small dense linear algebra ----------------------------------------------

def cholesky(a: list[list[float]]) -> list[list[float]]:
    n = len(a)
    L = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1):
            s = a[i][j] - sum(L[i][k] * L[j][k] for k in range(j))
            if i == j:
                if s <= 0:
                    raise ValueError("matrix is not positive definite")
                L[i][j] = math.sqrt(s)
            else:
                L[i][j] = s / L[j][j]
    return L


def _solve_chol(L: list[list[float]], b: list[float]) -> list[float]:
    n = len(L)
    y = [0.0] * n
    for i in range(n):
        y[i] = (b[i] - sum(L[i][k] * y[k] for k in range(i))) / L[i][i]
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        x[i] = (y[i] - sum(L[k][i] * x[k] for k in range(i + 1, n))) / L[i][i]
    return x


def _inverse_chol(L: list[list[float]]) -> list[list[float]]:
    n = len(L)
    cols = [_solve_chol(L, [1.0 if r == c else 0.0 for r in range(n)]) for c in range(n)]
    return [[cols[c][r] for c in range(n)] for r in range(n)]


# --- The fit -------------------------------------------------------------------

@dataclass
class Fit:
    names: list[str]            # "(intercept)" then "Group=level"
    mean: list[float]
    cov: list[list[float]]
    chol: list[list[float]]     # Cholesky factor of cov, for draws
    sigma: float
    log_evidence: float
    n: int

    def _x(self, app) -> list[int]:
        idx = {name: i for i, name in enumerate(self.names)}
        return [0] + [idx[f] for f in features(app) if f in idx]

    def linear(self, app) -> tuple[float, float]:
        """μ = xβ̂ and s² = xᵀΣx for the draft's active coefficients."""
        x = self._x(app)
        mu = sum(self.mean[i] for i in x)
        s2 = sum(self.cov[i][j] for i in x for j in x)
        return mu, max(s2, 0.0)

    def p(self, app) -> float:
        mu, s2 = self.linear(app)
        return _sigmoid(mu / math.sqrt(1 + math.pi * s2 / 8))

    def interval(self, app) -> tuple[float, float]:
        mu, s2 = self.linear(app)
        s = math.sqrt(s2)
        return _sigmoid(mu - Z90 * s), _sigmoid(mu + Z90 * s)

    def sample(self, rng: random.Random) -> list[float]:
        """One β from N(β̂, Σ)."""
        z = [rng.gauss(0, 1) for _ in self.mean]
        return [m + sum(self.chol[i][k] * z[k] for k in range(i + 1)) for i, m in enumerate(self.mean)]

    def p_with(self, beta: list[float], app) -> float:
        return _sigmoid(sum(beta[i] for i in self._x(app)))

    def coefficients(self) -> list[dict]:
        return [{"name": n, "mean": self.mean[i], "sd": math.sqrt(max(self.cov[i][i], 0.0))}
                for i, n in enumerate(self.names)]


def _fit_sigma(rows: list[tuple[list[int], float, float, float]], k: int, prior_mean: list[float],
               prior_var: list[float]) -> tuple[list[float], list[list[float]], float]:
    """Newton's method to the posterior mode. rows: (active indices, y, f, w). Returns β̂, H, log posterior at β̂."""
    beta = list(prior_mean)

    def log_post(b: list[float]) -> float:
        lp = 0.0
        for x, y, f, w in rows:
            eta = sum(b[i] for i in x)
            # log σ(η) and log(1 − σ(η)), stably.
            ls = -math.log1p(math.exp(-eta)) if eta > -30 else eta
            l1s = -math.log1p(math.exp(eta)) if eta < 30 else -eta
            lp += w * (y * ls + f * l1s)
        return lp - sum((b[j] - prior_mean[j]) ** 2 / (2 * prior_var[j]) for j in range(k))

    current = log_post(beta)
    H = None
    for _ in range(NEWTON_STEPS):
        g = [-(beta[j] - prior_mean[j]) / prior_var[j] for j in range(k)]
        H = [[0.0] * k for _ in range(k)]
        for j in range(k):
            H[j][j] = 1 / prior_var[j]
        for x, y, f, w in rows:
            p = _sigmoid(sum(beta[i] for i in x))
            r = w * (y * (1 - p) - f * p)
            h = w * (y + f) * p * (1 - p)
            for i in x:
                g[i] += r
                for j in x:
                    H[i][j] += h
        step = _solve_chol(cholesky(H), g)
        t = 1.0
        while True:
            trial = [b + t * s for b, s in zip(beta, step)]
            value = log_post(trial)
            if value >= current - 1e-12 or t < 1e-6:
                break
            t /= 2
        beta, gain, current = trial, value - current, value
        if abs(gain) < 1e-9:
            break
    # The curvature at the mode.
    H = [[0.0] * k for _ in range(k)]
    for j in range(k):
        H[j][j] = 1 / prior_var[j]
    for x, y, f, w in rows:
        p = _sigmoid(sum(beta[i] for i in x))
        h = w * (y + f) * p * (1 - p)
        for i in x:
            for j in x:
                H[i][j] += h
    return beta, H, current


def fit(applications: list, now=None) -> Fit | None:
    m = odds.odds_model(applications, now)
    if not m.evidence or m.base.p <= 0:
        return None
    names = ["(intercept)"] + sorted({f for e in m.evidence for f in features(e.app)})
    idx = {n: i for i, n in enumerate(names)}
    rows = [([0] + [idx[f] for f in features(e.app)], float(e.y), e.f, e.w) for e in m.evidence]
    k = len(names)
    best = None
    for sigma in SIGMAS:
        prior_mean = [_logit(m.base.p)] + [0.0] * (k - 1)
        prior_var = [INTERCEPT_SD ** 2] + [sigma ** 2] * (k - 1)
        beta, H, log_post = _fit_sigma(rows, k, prior_mean, prior_var)
        L = cholesky(H)
        # Laplace: log p(data | σ) ≈ log p(data, β̂) + (k/2)·log 2π − ½·log|H|,
        # with the prior's normalising constant included.
        log_prior_norm = -0.5 * sum(math.log(2 * math.pi * v) for v in prior_var)
        log_det_h = 2 * sum(math.log(L[i][i]) for i in range(k))
        evidence = log_post + log_prior_norm + 0.5 * k * math.log(2 * math.pi) - 0.5 * log_det_h
        if best is None or evidence > best[0]:
            best = (evidence, sigma, beta, L)
    evidence, sigma, beta, L = best
    cov = _inverse_chol(L)
    return Fit(names, beta, cov, cholesky(cov), sigma, evidence, len(m.evidence))


# --- A cache, until the applications change ------------------------------------

_cache: dict = {}


def _fingerprint(applications: list) -> tuple:
    return (len(applications),
            max((str(getattr(a, "updated_at", "")) for a in applications), default=""),
            sum(len(a.history or []) for a in applications))


def cached_fit(applications: list, now=None) -> Fit | None:
    key = _fingerprint(applications)
    day = (now.date() if now else None)
    if _cache.get("key") != (key, day):
        _cache["key"] = (key, day)
        _cache["fit"] = fit(applications, now)
    return _cache["fit"]


def drafts(applications: list, model: Fit, rng: random.Random | None = None) -> dict:
    """Each draft's P, 90% interval and one Thompson draw (one β shared by all drafts)."""
    from app.models.application import ApplicationStatus as S
    beta = model.sample(rng or random.Random())
    out = {}
    for a in applications:
        if a.status != S.SHORTLISTED:
            continue
        lo, hi = model.interval(a)
        mu, s2 = model.linear(a)
        out[str(a.id)] = {"p": model.p(a), "lo": lo, "hi": hi, "draw": model.p_with(beta, a),
                          "mu": mu, "s": math.sqrt(s2)}
    return out


def summary(applications: list, now=None, rng: random.Random | None = None) -> dict | None:
    model = cached_fit(applications, now)
    if model is None:
        return None
    return {
        "sigma": model.sigma,
        "n": model.n,
        "log_evidence": model.log_evidence,
        "coefficients": model.coefficients(),
        "drafts": drafts(applications, model, rng),
    }
