"""The maths behind every number on the Dashboard, the Queue and Friday's Quest.

Each entry: a title, the formula (`formula`, general) and the same formula
with this search's numbers in it (`here`). The web page and Friday show it
when a value is pointed at or tapped, so both read the same text from here.

Most entries are filled in on the server from the summary. Entries for
things that come in rows (a draft, a segment, a coefficient, a quest, a
reply-rate row) keep {placeholders} that the client fills from the row it
is showing: `vars` names them. A placeholder the client can't fill stays
visible as {name}, which a test guards against for the server-filled ones.
"""
from __future__ import annotations

import math

from app.core import odds
from app.core.gamification import FREEZE_CAP, FREEZE_EVERY
from app.core.quest import DAY_TARGET_XP, EXPLORE_SENDS, LUCKY_XP, OLDEST, QUEST_XP, SEND_SCALE
from app.core.runway import PACE_WINDOW_DAYS, PRIORS


def _f(x, d: int = 3) -> str:
    if x is None:
        return "–"
    if isinstance(x, float) and not math.isfinite(x):
        return "∞"
    return f"{x:.{d}f}" if isinstance(x, float) else str(x)


def _e(title: str, formula: list[str], here: list[str] | None = None, vars: list[str] | None = None) -> dict:
    return {"title": title, "formula": formula, "here": here or [], "vars": vars or []}


def build(summary: dict, regression: dict | None = None) -> dict:
    g: dict[str, dict] = {}
    o = summary.get("odds") or {}
    base = o.get("base") or {}
    p0 = base.get("p", 0.0)
    cal = o.get("calibration") or {}
    game = summary.get("game") or {}
    week = summary.get("week") or {}
    streak = summary.get("streak") or {}
    funnel = summary.get("funnel") or {}
    r = summary.get("runway")

    # --- The runway -------------------------------------------------------------
    if r:
        st = {s["label"]: s for s in r["stages"]}
        p = r["offer_per_application"]
        q = r["in_flight_chance"]
        n = r["projected_applications"]
        g["runway.chance"] = _e(
            "P(at least one offer in time)",
            ["P = 1 − (1 − q)·(1 − p)ⁿ",
             "p = offer per application = r·i·o (the three stage rates)",
             "n = pace × weeks left; q = chance from applications in flight",
             "Applications treated as independent Bernoulli trials."],
            [f"p = {_f(p, 4)}, n = {_f(n, 1)}, q = {_f(q)}",
             f"P = 1 − (1 − {_f(q)})·(1 − {_f(p, 4)})^{_f(n, 1)} = {_f(r['chance'])}"])
        recent = round(r["pace_per_week"] * PACE_WINDOW_DAYS / 7)
        g["runway.pace"] = _e(
            "Pace",
            [f"pace = (applications sent in the last {PACE_WINDOW_DAYS} days) / {PACE_WINDOW_DAYS // 7} weeks"],
            [f"{recent} / {PACE_WINDOW_DAYS // 7} = {_f(r['pace_per_week'], 2)} a week"])
        need = r["need_per_week"].get("80")
        g["runway.need"] = _e(
            "Pace for a target chance T",
            ["Solve 1 − (1 − q)(1 − p)ⁿ = T for n:",
             "n* = log((1 − T)/(1 − q)) / log(1 − p)",
             "pace* = n* / weeks left"],
            [f"T = 0.8: n* = log(0.2/(1 − {_f(q)})) / log(1 − {_f(p, 4)}) = {_f(need * r['weeks_left'], 1) if need is not None else '–'}",
             f"pace* = n* / {_f(r['weeks_left'], 1)} = {_f(need, 2)} a week"])
        for key, label, prior in (("reply", "Reply", PRIORS["reply"]), ("interview", "Interview", PRIORS["interview"]),
                                  ("offer", "Offer", PRIORS["offer"])):
            s = st.get(label)
            if not s:
                continue
            a, b = prior["a"], prior["b"]
            prev = {"reply": "sent", "interview": "replied", "offer": "interviewed"}[key]
            done = {"reply": "replied", "interview": "reached an interview", "offer": "got an offer"}[key]
            g[f"runway.stage.{key}"] = _e(
                f"{label} rate",
                [f"rate = (s + a) / (t + a + b): the posterior mean under a Beta(a, b) prior",
                 f"s = {done}, t = {prev}; prior Beta({a}, {b}), mean {a}/{a + b}"],
                [f"({s['successes']} + {a}) / ({s['trials']} + {a} + {b}) = {_f(s['rate'])}"
                 + (" (prior outweighs the data: t < a + b)" if s["assumed"] else "")])
        rr, ii, oo = (st[k]["rate"] for k in ("Reply", "Interview", "Offer"))
        g["runway.per_application"] = _e(
            "Offer per application",
            ["p = r · i · o", "applications per offer = 1/p (the mean of a geometric distribution)"],
            [f"{_f(rr)} · {_f(ii)} · {_f(oo)} = {_f(p, 4)}", f"1/p = {_f(r['applications_per_offer'], 0)}"])
        g["runway.in_flight"] = _e(
            "Chance from applications in flight",
            ["q = 1 − Π_j (1 − p_j)",
             "p_j = p for one sent and waiting (within the hiring window), i·o after a reply, o in interviews"],
            [f"{r['in_flight']} live, q = {_f(q)}"])
        g["runway.weeks_left"] = _e(
            "Weeks left to apply",
            ["last day = deadline − paperwork weeks − hiring weeks", "weeks left = (last day − today) / 7"],
            [f"{r['deadline']} → offer by {r['offer_by']} → apply by {r['last_apply_by']}: {_f(r['weeks_left'], 1)} weeks"])

    # --- The week and today ------------------------------------------------------
    t = (game.get("today") or {})
    if week.get("target") is not None:
        g["week.target"] = _e(
            "The week's target",
            ["⌈pace*⌉ for T = 0.8 (see Pace for a target chance)"],
            [f"⌈{_f((r or {}).get('need_per_week', {}).get('80'), 2)}⌉ = {week['target']}"])
    if t.get("target") is not None:
        before = week.get("sent", 0) - t.get("sent", 0)
        d = week.get("working_days_left", 1)
        g["game.day_target"] = _e(
            "Today's target",
            ["today = ⌈max(0, T_week − sent before today) / working days left⌉"],
            [f"⌈max(0, {week.get('target')} − {before}) / {d}⌉ = {t['target']}"])
    g["game.banked"] = _e(
        "Interviews banked",
        ["E = Σ_j P(interview_j | no reply after t_j days)",
         "P(I | silence) = p(1 − G(t)) / (1 − p·G(t))   (Bayes' rule)",
         "p = the application's P at sending; G = share of replies in by t"],
        [f"E = {_f(game.get('banked'), 3)} over the applications still waiting"])
    g["odds.G"] = _e(
        "G(t): replies in by day t",
        ["G(t) = (m·F̂(t) + 5·min(1, t/42)) / (m + 5)",
         "F̂ = empirical CDF of the m reply delays seen; a 42-day ramp worth 5 observations"],
        [f"m = {o.get('reply_delays', 0)} reply delays"])
    g["odds.decay"] = _e(
        "Decay weight",
        ["w = 0.98^(weeks since sent)", "half-weight after log 0.5 / log 0.98 ≈ 34 weeks"])

    # --- The segment model -------------------------------------------------------
    if base:
        g["odds.base"] = _e(
            "p₀: the overall interview rate",
            ["p₀ = Σ w·y / Σ w·(y + f)",
             "y = 1 if it reached an interview; f = 1 if closed without, G(t) while waiting"],
            [f"{base.get('interviews')} interview{'' if base.get('interviews') == 1 else 's'} over {base.get('sent')} sent, weighted: p₀ = {_f(p0)}",
             f"Beta({_f(base.get('alpha'), 2)}, {_f(base.get('beta'), 2)}), 90% interval [{_f(base.get('lo'))}, {_f(base.get('hi'))}]"])
    g["odds.segment"] = _e(
        "A segment's P(interview)",
        [f"p ~ Beta(K·p₀, K·(1 − p₀)), K = {odds.K}",
         "α = K·p₀ + Σ w·y,  β = K·(1 − p₀) + Σ w·f",
         "E[p] = α / (α + β); interval = Beta quantiles 0.05 and 0.95"],
        ["{kind} · {name}: {i} interviews of {n}",
         "α = {alpha}, β = {beta}; E[p] = {p}; 90% [{lo}, {hi}]"],
        ["kind", "name", "i", "n", "alpha", "beta", "p", "lo", "hi"])
    g["odds.draft_segments"] = _e(
        "A draft's P (segment model)",
        ["P = (p_tier · p_role · p_fit)^(1/3), the geometric mean of its segments' E[p]"],
        ["P = {p}"], ["p"])

    # --- Calibration -----------------------------------------------------------------
    if cal.get("n"):
        g["calibration"] = _e(
            "Calibration",
            ["Over settled sends with a stored prediction p_i and outcome y_i:",
             "Brier B = (1/n) Σ (p_i − y_i)²; always predicting p₀ scores p₀(1 − p₀)",
             "Σp_i should be close to Σy_i"],
            [f"n = {cal['n']}: Σp = {_f(cal['expected'], 2)}, Σy = {cal['observed']}",
             f"B = {_f(cal['brier'], 4)} vs p₀(1 − p₀) = {_f(p0 * (1 - p0), 4)}"])
    else:
        g["calibration"] = _e("Calibration", ["Brier B = (1/n) Σ (p_i − y_i)² over settled sends"],
                              ["No settled sends with a stored prediction yet."])

    # --- The game ---------------------------------------------------------------------
    g["game.xp_send"] = _e(
        "Points for a send",
        [f"XP = max(1, round({SEND_SCALE}·p)), p = P(interview) at sending",
         "so E[interviews] = Σ XP / 1000"],
        [f"at p₀: max(1, round({SEND_SCALE}·{_f(p0)})) = {max(1, round(SEND_SCALE * p0))}"])
    g["game.lucky"] = _e(
        "Lucky draw",
        ["x_s ~ Beta(α_s, β_s) for the draft's three segments",
         "draw = (x_tier·x_role·x_fit)^(1/3); lucky if draw ≥ (q95_tier·q95_role·q95_fit)^(1/3)",
         f"pays +{LUCKY_XP}; P(lucky) < 0.05"])
    g["game.freezes"] = _e(
        "Streak freezes",
        [f"+1 when the streak reaches a multiple of {FREEZE_EVERY}, at most {FREEZE_CAP}",
         "a gap of m missed working days is bridged iff m ≤ freezes; freezes −= m"],
        [f"held: {streak.get('freezes', 0)}"])
    g["game.quest.volume"] = _e(
        "Quest: the week's target",
        ["done when sent this week ≥ T_week", f"+{QUEST_XP['volume']} XP"],
        ["{progress} / {target}"], ["progress", "target"])
    g["game.quest.explore"] = _e(
        "Quest: explore",
        ["segment* = argmax over segments with n ≥ 3 (not Unknown/Unscored) of (hi − lo),",
         "the widest 90% interval, from the model as of Monday 00:00",
         f"done after {EXPLORE_SENDS} sends in it this week; +{QUEST_XP['explore']} XP"],
        ["{detail}", "{progress} / {target}"], ["detail", "progress", "target"])
    g["game.quest.oldest"] = _e(
        "Quest: the oldest drafts",
        [f"the {OLDEST} drafts created earliest among those still Shortlisted at Monday 00:00",
         f"done when each is sent or set aside; +{QUEST_XP['oldest']} XP"],
        ["{progress} / {target}"], ["progress", "target"])
    g["game.day_bonus"] = _e("Day target bonus", [f"+{DAY_TARGET_XP} XP once a day when sent today ≥ today's target"])
    nl = streak.get("next_level")
    g["level"] = _e(
        "Level",
        ["level = max{ℓ : points ≥ min_ℓ}", "points = Σ PointHistory"],
        [f"{streak.get('points')} points: level {streak.get('level')}"
         + (f"; next ({nl['name']}) at {nl['minPoints']}, {nl['minPoints'] - streak.get('points', 0)} to go" if nl else "; top level")])
    g["streak"] = _e(
        "Streak",
        ["consecutive working days with activity; weekends, holidays and leave are skipped"],
        [f"current {streak.get('current')}, longest {streak.get('longest')}"])

    # --- Rates on the Dashboard and in Friday -------------------------------------------
    sent = funnel.get("sent", 0)
    if sent:
        g["rate.response"] = _e(
            "Positive response rate",
            ["replied / sent  (a reply or any later stage; rejections and ghosting don't count)"],
            [f"{funnel.get('replied')} / {sent} = {_f(funnel.get('replied', 0) / sent)}"])
        g["rate.interview"] = _e(
            "Interview rate",
            ["interviewed / sent  (raw; the models above shrink it and weight it)"],
            [f"{funnel.get('interviewed')} / {sent} = {_f(funnel.get('interviewed', 0) / sent)}"])
    g["rate.row"] = _e(
        "Reply rate",
        ["replied / sent for this group; fewer than 5 sent is too few to read"],
        ["{name}: {replied} / {sent} = {rate}"], ["name", "replied", "sent", "rate"])
    g["queue.expected"] = _e(
        "Expected interviews",
        ["E = Σ_j p_j (linearity of expectation; holds without independence)"],
        ["E = {e} over {n} applications"], ["e", "n"])

    # --- The regression ------------------------------------------------------------------
    g["model.p"] = _e(
        "A draft's P (regression)",
        ["μ = b₀ + Σ b[group, level],  s² = xᵀ H⁻¹ x",
         "P = E[σ(xβ)] ≈ σ(μ / √(1 + π s²/8))   (probit approximation)"],
        ["μ = {mu}, s = {s}", "P = σ({mu} / √(1 + π·{s}²/8)) = {p}"], ["mu", "s", "p"])
    g["model.interval"] = _e(
        "90% interval",
        ["[σ(μ − 1.645 s), σ(μ + 1.645 s)]"],
        ["[σ({mu} − 1.645·{s}), σ({mu} + 1.645·{s})] = [{lo}, {hi}]"], ["mu", "s", "lo", "hi"])
    g["model.draw"] = _e(
        "Explore (Thompson sampling)",
        ["draw one β̃ ~ N(β̂, H⁻¹), shared by every draft", "rank drafts by σ(x β̃)",
         "a draft comes first with probability P(it is the best)"])
    g["model.coef"] = _e(
        "A coefficient",
        ["prior b ~ N(0, σ²); posterior ≈ N(b̂, sd²) (Laplace)",
         "exp(b̂) = odds ratio against the average; |b̂| > 2 sd: clear of zero"],
        ["{name}: b̂ = {mean}, sd = {sd}", "z = {z}, exp(b̂) = {or}"], ["name", "mean", "sd", "z", "or"])
    if regression:
        k = len(regression.get("coefficients", []))
        g["model.sigma"] = _e(
            "σ: how much the levels pool",
            ["σ = argmax over {0.25, 0.5, 1, 2} of log p(D | σ)",
             "log p(D | σ) ≈ log p(D, β̂) + (k/2)·log 2π − ½·log|H|   (Laplace)"],
            [f"σ = {regression['sigma']}, k = {k} coefficients, n = {regression['n']} sent",
             f"log p(D | σ) = {_f(regression.get('log_evidence'), 2)}"])
    return g
