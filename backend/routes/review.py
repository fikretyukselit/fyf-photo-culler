import base64
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.state import state
from backend import persistence

router = APIRouter()

VALID_DESTINATIONS = {
    "keep", "maybe", "reject", "blurry", "dark", "overexposed", "duplicate", "similar",
}

# Cap on undo depth — enough for a long review session without unbounded memory.
MAX_HISTORY = 200


def _decode_id(photo_id: str) -> str:
    return base64.urlsafe_b64decode(photo_id.encode()).decode()


def _snapshot(paths: list) -> dict:
    """Capture the current override value (or None if unset) for each path,
    so an action can be undone precisely."""
    return {p: state.overrides.get(p) for p in paths}


def _push_history(before: dict) -> None:
    """Record the pre-action override values and clear the redo stack.
    Must be called while holding state.lock."""
    state.undo_stack.append(before)
    if len(state.undo_stack) > MAX_HISTORY:
        state.undo_stack.pop(0)
    state.redo_stack.clear()


def _apply(before: dict, after: dict) -> None:
    """Apply a set of override changes; None means 'clear the override'.
    Must be called while holding state.lock."""
    for p, dest in after.items():
        if dest is None:
            state.overrides.pop(p, None)
        else:
            state.overrides[p] = dest


class OverrideRequest(BaseModel):
    photo_id: str
    destination: str


class BatchOverrideRequest(BaseModel):
    photo_ids: List[str]
    destination: str


class ResetRequest(BaseModel):
    photo_id: str


@router.post("/api/override")
def set_override(req: OverrideRequest):
    try:
        path = _decode_id(req.photo_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid photo ID")

    if path not in state.analyses:
        raise HTTPException(status_code=404, detail="Photo not found")

    if req.destination not in VALID_DESTINATIONS:
        raise HTTPException(status_code=400, detail=f"Invalid destination: {req.destination}")

    with state.lock:
        _push_history(_snapshot([path]))
        state.overrides[path] = req.destination
    persistence.save_overrides(state)
    return {"status": "ok"}


@router.post("/api/override/batch")
def set_batch_override(req: BatchOverrideRequest):
    if req.destination not in VALID_DESTINATIONS:
        raise HTTPException(status_code=400, detail=f"Invalid destination: {req.destination}")

    paths = []
    for pid in req.photo_ids:
        try:
            path = _decode_id(pid)
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid photo ID: {pid}")
        if path not in state.analyses:
            raise HTTPException(status_code=404, detail=f"Photo not found: {pid}")
        paths.append(path)

    with state.lock:
        _push_history(_snapshot(paths))
        for path in paths:
            state.overrides[path] = req.destination
    persistence.save_overrides(state)
    return {"status": "ok", "count": len(paths)}


@router.post("/api/override/reset")
def reset_override(req: ResetRequest):
    try:
        path = _decode_id(req.photo_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid photo ID")

    with state.lock:
        _push_history(_snapshot([path]))
        state.overrides.pop(path, None)
    persistence.save_overrides(state)
    return {"status": "ok"}


@router.post("/api/override/reset-all")
def reset_all_overrides():
    with state.lock:
        _push_history(_snapshot(list(state.overrides.keys())))
        state.overrides.clear()
    persistence.save_overrides(state)
    return {"status": "ok"}


@router.post("/api/undo")
def undo():
    """Revert the most recent override action. Returns the affected paths so
    the client can refresh just those, plus whether more undo/redo remains."""
    with state.lock:
        if not state.undo_stack:
            return {"status": "noop", "can_undo": False, "can_redo": bool(state.redo_stack)}
        before = state.undo_stack.pop()
        # For redo, capture the current values of exactly those paths.
        redo_entry = {p: state.overrides.get(p) for p in before}
        state.redo_stack.append(redo_entry)
        _apply(redo_entry, before)
        affected = list(before.keys())
        can_undo = bool(state.undo_stack)
        can_redo = bool(state.redo_stack)
    persistence.save_overrides(state)
    return {"status": "ok", "affected": affected, "can_undo": can_undo, "can_redo": can_redo}


@router.post("/api/redo")
def redo():
    """Re-apply the most recently undone action."""
    with state.lock:
        if not state.redo_stack:
            return {"status": "noop", "can_undo": bool(state.undo_stack), "can_redo": False}
        after = state.redo_stack.pop()
        undo_entry = {p: state.overrides.get(p) for p in after}
        state.undo_stack.append(undo_entry)
        _apply(undo_entry, after)
        affected = list(after.keys())
        can_undo = bool(state.undo_stack)
        can_redo = bool(state.redo_stack)
    persistence.save_overrides(state)
    return {"status": "ok", "affected": affected, "can_undo": can_undo, "can_redo": can_redo}


@router.get("/api/history")
def history():
    """Report whether undo/redo are currently available."""
    return {"can_undo": bool(state.undo_stack), "can_redo": bool(state.redo_stack)}
