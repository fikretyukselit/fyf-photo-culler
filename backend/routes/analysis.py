import json
import os
import threading
import time
from typing import List

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from culling.technical import analyze_photo
from culling.duplicates import detect_duplicates_and_similar
from culling.utils import list_jpeg_files_multi
from backend.state import state

router = APIRouter()


class AnalyzeRequest(BaseModel):
    folders: List[str]
    merge: bool = True
    output: str = "./output"


def _update_progress(stage: str, current: int, total: int, current_file: str = ""):
    pct = int((current / total) * 100) if total > 0 else 0
    with state.lock:
        state.progress["stage"] = stage
        state.progress["current"] = current
        state.progress["total"] = total
        state.progress["pct"] = pct
        state.progress["current_file"] = current_file
        state.progress["stages"][stage] = {"current": current, "total": total, "pct": pct}


def _run_pipeline():
    try:
        # Collect JPEG files from all folders
        _update_progress("scanning", 0, 0, "Scanning folders...")
        folder_files = list_jpeg_files_multi(state.input_folders)
        all_files = []
        for files in folder_files.values():
            all_files.extend(files)

        if not all_files:
            _update_progress("error", 0, 0, "No JPEG files found")
            with state.lock:
                state.is_running = False
            return

        total_files = len(all_files)
        skipped = []

        # Stage 1: Technical Analysis
        _update_progress("technical_analysis", 0, total_files, "")
        analyses = {}
        for i, path in enumerate(all_files):
            if state.cancel_requested:
                _update_progress("cancelled", i, total_files, "")
                with state.lock:
                    state.is_running = False
                return

            result = analyze_photo(path)
            if result is None:
                skipped.append(path)
            else:
                analyses[path] = result

            _update_progress(
                "technical_analysis", i + 1, total_files,
                os.path.basename(path)
            )

        # Separate auto-rejected from candidates
        auto_rejected = {p: a for p, a in analyses.items() if a["auto_reject"]}
        candidates = [p for p in analyses if not analyses[p]["auto_reject"]]

        # Stage 2: Duplicate & Similar Detection
        if candidates and not state.cancel_requested:
            def dup_progress(sub_stage: str, current: int, total: int):
                _update_progress(
                    f"duplicate_detection:{sub_stage}",
                    current, total,
                    f"{sub_stage} ({current}/{total})"
                )

            keep_set, dup_sim_rejects = detect_duplicates_and_similar(
                candidates, analyses, progress_callback=dup_progress
            )
        else:
            dup_sim_rejects = {}

        if state.cancel_requested:
            _update_progress("cancelled", 0, 0, "")
            with state.lock:
                state.is_running = False
            return

        # Build destinations dict (mirrors cull.py logic)
        destinations = {}
        # Auto-rejected
        for p, a in auto_rejected.items():
            destinations[p] = a["reject_reason"]
        # Duplicates & similar
        for p, reason in dup_sim_rejects.items():
            destinations[p] = reason
        # Remaining candidates -> assign by tier
        for p in candidates:
            if p not in destinations:
                tier = analyses[p]["tier"]
                if tier == "good":
                    destinations[p] = "keep"
                elif tier == "marginal":
                    destinations[p] = "maybe"
                else:
                    destinations[p] = analyses[p].get("reject_reason") or "blurry"

        # Store everything in state
        with state.lock:
            state.analyses = analyses
            state.destinations = destinations
            state.progress["stage"] = "complete"
            state.progress["current"] = total_files
            state.progress["total"] = total_files
            state.progress["pct"] = 100
            state.progress["current_file"] = ""
            state.is_running = False

    except Exception as e:
        _update_progress("error", 0, 0, str(e))
        with state.lock:
            state.is_running = False


@router.post("/api/analyze")
def start_analysis(req: AnalyzeRequest):
    with state.lock:
        if state.is_running:
            return {"error": "Analysis already in progress"}
        state.is_running = True
        state.cancel_requested = False
        state.input_folders = req.folders
        state.merge_mode = req.merge
        state.output_dir = req.output
        state.analyses = {}
        state.destinations = {}
        state.overrides = {}
        state.progress = {
            "stage": "starting",
            "current": 0,
            "total": 0,
            "pct": 0,
            "current_file": "",
            "stages": {}
        }

    thread = threading.Thread(target=_run_pipeline, daemon=True)
    thread.start()
    return {"status": "started"}


@router.get("/api/progress")
def progress_stream():
    def event_generator():
        while True:
            with state.lock:
                data = json.dumps(state.progress)
                running = state.is_running
            yield f"data: {data}\n\n"
            if not running:
                break
            time.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/api/cancel")
def cancel_analysis():
    with state.lock:
        if state.is_running:
            state.cancel_requested = True
            return {"status": "cancel_requested"}
        return {"status": "not_running"}
