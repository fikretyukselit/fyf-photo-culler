import json
import os
import time

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from culling.organizer import organize_photos, DEST_TO_DIR
from culling.utils import safe_copy
from backend.state import state

router = APIRouter()


def _effective_destinations() -> dict:
    """Merge computed destinations with user overrides."""
    merged = dict(state.destinations)
    merged.update(state.overrides)
    return merged


@router.get("/api/export/preview")
def export_preview():
    destinations = _effective_destinations()
    counts = {}
    for dest in destinations.values():
        counts[dest] = counts.get(dest, 0) + 1
    return counts


@router.get("/api/export")
def export_photos():
    def _export_stream():
        destinations = _effective_destinations()
        paths = list(state.analyses.keys())
        total = len(paths)

        if not paths:
            yield f"data: {json.dumps({'stage': 'error', 'message': 'No photos to export'})}\n\n"
            return

        output_dir = state.output_dir

        if state.merge_mode or len(state.input_folders) <= 1:
            # Single output directory
            for i, path in enumerate(paths):
                dest_key = destinations.get(path)
                if dest_key is None:
                    continue
                sub_dir = DEST_TO_DIR.get(dest_key, "reject")
                safe_copy(path, os.path.join(output_dir, sub_dir))
                pct = int(((i + 1) / total) * 100)
                yield f"data: {json.dumps({'stage': 'exporting', 'current': i + 1, 'total': total, 'pct': pct, 'current_file': os.path.basename(path)})}\n\n"
        else:
            # Multi-folder non-merged: output per folder with prefix
            for folder_idx, folder in enumerate(state.input_folders):
                folder_name = os.path.basename(os.path.normpath(folder))
                folder_output = os.path.join(output_dir, folder_name)
                folder_paths = [p for p in paths if p.startswith(os.path.abspath(folder))]
                for i, path in enumerate(folder_paths):
                    dest_key = destinations.get(path)
                    if dest_key is None:
                        continue
                    sub_dir = DEST_TO_DIR.get(dest_key, "reject")
                    safe_copy(path, os.path.join(folder_output, sub_dir))
                    overall = sum(1 for f in state.input_folders[:folder_idx]
                                  for p2 in paths if p2.startswith(os.path.abspath(f))) + i + 1
                    pct = int((overall / total) * 100)
                    yield f"data: {json.dumps({'stage': 'exporting', 'current': overall, 'total': total, 'pct': pct, 'current_file': os.path.basename(path)})}\n\n"

        yield f"data: {json.dumps({'stage': 'complete', 'current': total, 'total': total, 'pct': 100, 'current_file': ''})}\n\n"

    return StreamingResponse(_export_stream(), media_type="text/event-stream")
