"""Outcome definitions shared with the frontend's utils/stages.ts.

The Dashboard, Analytics, the Runway card and the weekly email must agree on
what counts as sent, a positive response and an interview, so this mirrors the
TypeScript one for one. Change both together.
"""
from app.models.application import ApplicationStatus as S

# The forward pipeline, in order. Rejected and Ghosted sit outside it.
PIPELINE = [S.SHORTLISTED, S.APPLIED, S.REPLIED, S.PHONE_SCREEN,
            S.TECHNICAL_ROUND_1, S.TECHNICAL_ROUND_2, S.FINAL_ROUND, S.OFFER]
CLOSED = [S.REJECTED, S.GHOSTED]
INTERVIEW = [S.PHONE_SCREEN, S.TECHNICAL_ROUND_1, S.TECHNICAL_ROUND_2, S.FINAL_ROUND]
REACHED_INTERVIEW = INTERVIEW + [S.OFFER]
# A human engaged. A rejection is a "no" and ghosting is silence — neither counts.
POSITIVE = [S.REPLIED] + REACHED_INTERVIEW


def _is_rewind(old, new) -> bool:
    """A move that rewrites where the application stands rather than advancing it."""
    if old is None:
        return False
    if old in CLOSED:
        return new in PIPELINE
    return old in PIPELINE and new in PIPELINE and PIPELINE.index(new) < PIPELINE.index(old)


def effective_history(app) -> list[tuple]:
    """(old, new) moves in order, with the step each correction undid dropped."""
    path: list[tuple] = []
    for h in sorted(app.history or [], key=lambda h: h.changed_at):
        old, new = h.old_status, h.new_status
        if not _is_rewind(old, new):
            path.append((old, new))
            continue
        undone = path.pop() if path and path[-1][1] == old else None
        frm = path[-1][1] if path else (undone[0] if undone else None)
        if frm != new:
            path.append((frm, new))
    return path


def _held(app) -> set:
    held = {app.status}
    for old, new in effective_history(app):
        held.update({old, new})
    return held


def is_submitted(app) -> bool:
    """Sent to the employer: not a draft, and not a draft skipped straight to Rejected."""
    if app.status == S.SHORTLISTED:
        return False
    path = effective_history(app)
    skipped = (S.SHORTLISTED, S.REJECTED) in path and not any(new == S.APPLIED for _, new in path)
    return not skipped


def has_positive_response(app) -> bool:
    return bool(_held(app) & set(POSITIVE))


def has_reached_interview(app) -> bool:
    return bool(_held(app) & set(REACHED_INTERVIEW))
