from fastapi import APIRouter

from backend.state import state
from backend import persistence

router = APIRouter()


def _summary() -> dict:
    counts = {"keep": 0, "maybe": 0, "reject": 0}
    for path in state.analyses:
        dest = state.overrides.get(path, state.destinations.get(path, "reject"))
        if dest == "keep":
            counts["keep"] += 1
        elif dest == "maybe":
            counts["maybe"] += 1
        else:
            counts["reject"] += 1
    counts["total"] = sum(counts.values())
    return counts


@router.get("/api/session")
def get_session():
    """Report whether a previous session was restored from disk and can be
    resumed. `resumable` is only true right after startup (before the user
    starts a fresh analysis, which clears the flag)."""
    return {
        "resumable": state.loaded_from_disk and bool(state.analyses),
        "saved_at": state.saved_at,
        "input_folders": state.input_folders,
        "summary": _summary() if state.analyses else None,
    }


@router.post("/api/session/discard")
def discard_session():
    """Delete the saved session and clear it from memory."""
    persistence.clear()
    with state.lock:
        state.analyses = {}
        state.destinations = {}
        state.overrides = {}
        state.groups = {}
        state.path_to_group = {}
        state.undo_stack = []
        state.redo_stack = []
        state.loaded_from_disk = False
        state.saved_at = None
    return {"status": "ok"}
