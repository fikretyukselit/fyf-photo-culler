import base64
import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from backend.state import state
from backend.thumbnail import get_thumbnail

router = APIRouter()


def _encode_id(path: str) -> str:
    return base64.urlsafe_b64encode(path.encode()).decode()


def _decode_id(photo_id: str) -> str:
    return base64.urlsafe_b64decode(photo_id.encode()).decode()


def _effective_destination(path: str) -> str:
    """Return override destination if set, otherwise the computed destination."""
    return state.overrides.get(path, state.destinations.get(path, "unknown"))


def _photo_entry(path: str, analysis: dict) -> dict:
    group_id = state.path_to_group.get(path)
    group = state.groups.get(group_id) if group_id else None
    return {
        "id": _encode_id(path),
        "filename": os.path.basename(path),
        "path": path,
        "quality_score": analysis.get("quality_score"),
        "tier": analysis.get("tier"),
        "destination": _effective_destination(path),
        "sharpness": analysis.get("sharpness_raw"),
        "exposure": analysis.get("exposure"),
        "contrast": analysis.get("contrast"),
        "exif_score": analysis.get("exif_score"),
        "iso": analysis.get("iso"),
        "shutter_speed": analysis.get("shutter_speed"),
        "aperture": analysis.get("aperture"),
        "file_size": analysis.get("file_size"),
        "group_id": group_id,
        "group_size": len(group["members"]) if group else None,
        "is_group_best": bool(group and group["best"] == path),
    }


REJECT_SUBTYPES = ("reject", "blurry", "dark", "overexposed", "duplicate", "similar")


def _category_matches(destination: str, category: str) -> bool:
    """Check if a destination matches a category filter.
    'reject' matches all reject sub-types."""
    if category == "reject":
        return destination in REJECT_SUBTYPES
    return destination == category


def _is_mismatch(analysis: dict, destination: str) -> bool:
    """True when the engine's tier disagrees with the effective destination:
    a 'good' photo sent to reject, or an 'unacceptable' photo kept."""
    tier = analysis.get("tier")
    if tier == "good" and destination in REJECT_SUBTYPES:
        return True
    if tier == "unacceptable" and destination == "keep":
        return True
    return False


@router.get("/api/photos")
def list_photos(
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    min_score: Optional[float] = Query(None),
    max_score: Optional[float] = Query(None),
    min_iso: Optional[int] = Query(None),
    max_iso: Optional[int] = Query(None),
    reject_reason: Optional[str] = Query(None),
    mismatch: bool = Query(False),
):
    photos = []
    for path, analysis in state.analyses.items():
        dest = _effective_destination(path)
        if category and not _category_matches(dest, category):
            continue

        score = analysis.get("quality_score")
        if min_score is not None and (score is None or score < min_score):
            continue
        if max_score is not None and (score is None or score > max_score):
            continue

        iso = analysis.get("iso")
        if min_iso is not None and (iso is None or iso < min_iso):
            continue
        if max_iso is not None and (iso is None or iso > max_iso):
            continue

        if reject_reason is not None and dest != reject_reason:
            continue

        if mismatch and not _is_mismatch(analysis, dest):
            continue

        photos.append(_photo_entry(path, analysis))

    # Sort by quality score descending
    photos.sort(key=lambda p: p["quality_score"] or 0, reverse=True)

    total = len(photos)
    start = (page - 1) * limit
    end = start + limit
    return {
        "photos": photos[start:end],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if total > 0 else 0,
    }


@router.get("/api/photos/{photo_id}/thumbnail")
def photo_thumbnail(photo_id: str):
    try:
        path = _decode_id(photo_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid photo ID")

    if path not in state.analyses:
        raise HTTPException(status_code=404, detail="Photo not found")

    try:
        thumb_path = get_thumbnail(path)
        return FileResponse(thumb_path, media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/photos/{photo_id}/full")
def photo_full(photo_id: str):
    try:
        path = _decode_id(photo_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid photo ID")

    if path not in state.analyses:
        raise HTTPException(status_code=404, detail="Photo not found")

    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(path, media_type="image/jpeg")


@router.get("/api/photos/{photo_id}")
def photo_detail(photo_id: str):
    try:
        path = _decode_id(photo_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid photo ID")

    if path not in state.analyses:
        raise HTTPException(status_code=404, detail="Photo not found")

    return _photo_entry(path, state.analyses[path])


@router.get("/api/groups/{group_id}")
def group_detail(group_id: str):
    group = state.groups.get(group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")

    members = [
        _photo_entry(p, state.analyses[p])
        for p in group["members"]
        if p in state.analyses
    ]
    return {
        "id": group["id"],
        "kind": group["kind"],
        "best": _encode_id(group["best"]),
        "members": members,
    }


@router.get("/api/summary")
def summary():
    counts = {"keep": 0, "maybe": 0, "reject": 0}
    for path in state.analyses:
        dest = _effective_destination(path)
        if dest == "keep":
            counts["keep"] += 1
        elif dest == "maybe":
            counts["maybe"] += 1
        else:
            counts["reject"] += 1

    counts["total"] = sum(counts.values())
    return counts
