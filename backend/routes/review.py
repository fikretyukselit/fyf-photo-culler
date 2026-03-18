import base64
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.state import state

router = APIRouter()


def _decode_id(photo_id: str) -> str:
    return base64.urlsafe_b64decode(photo_id.encode()).decode()


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

    valid_destinations = {"keep", "maybe", "blurry", "dark", "overexposed", "duplicate", "similar"}
    if req.destination not in valid_destinations:
        raise HTTPException(status_code=400, detail=f"Invalid destination: {req.destination}")

    with state.lock:
        state.overrides[path] = req.destination
    return {"status": "ok"}


@router.post("/api/override/batch")
def set_batch_override(req: BatchOverrideRequest):
    valid_destinations = {"keep", "maybe", "blurry", "dark", "overexposed", "duplicate", "similar"}
    if req.destination not in valid_destinations:
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
        for path in paths:
            state.overrides[path] = req.destination
    return {"status": "ok", "count": len(paths)}


@router.post("/api/override/reset")
def reset_override(req: ResetRequest):
    try:
        path = _decode_id(req.photo_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid photo ID")

    with state.lock:
        state.overrides.pop(path, None)
    return {"status": "ok"}


@router.post("/api/override/reset-all")
def reset_all_overrides():
    with state.lock:
        state.overrides.clear()
    return {"status": "ok"}
