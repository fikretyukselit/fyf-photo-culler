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
    }


def _category_matches(destination: str, category: str) -> bool:
    """Check if a destination matches a category filter.
    'reject' matches all reject sub-types."""
    if category == "reject":
        return destination in ("blurry", "dark", "overexposed", "duplicate", "similar")
    return destination == category


@router.get("/api/photos")
def list_photos(
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    photos = []
    for path, analysis in state.analyses.items():
        dest = _effective_destination(path)
        if category and not _category_matches(dest, category):
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


@router.get("/api/photos/{photo_id}")
def photo_detail(photo_id: str):
    try:
        path = _decode_id(photo_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid photo ID")

    if path not in state.analyses:
        raise HTTPException(status_code=404, detail="Photo not found")

    return _photo_entry(path, state.analyses[path])


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
