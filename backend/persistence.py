"""Session persistence — survives crashes, restarts and in-app updates.

Analysis results are expensive but reproducible; user review decisions
(overrides) are irreplaceable human effort. Both are written to the platform
app-data directory so a closed/crashed/updated app can resume where it left off.

Two files so the frequent write stays small:
  session_analysis.json   — analyses/destinations/groups/config (written once
                            per analysis run)
  session_overrides.json  — the overrides map (rewritten on every review action)
"""

import json
import os
import sys
import time

APP_NAME = "fyf-photo"


def app_data_dir() -> str:
    """Platform-appropriate, writable per-user data directory.
    Honors the FYF_DATA_DIR environment variable (used by tests)."""
    override = os.environ.get("FYF_DATA_DIR")
    if override:
        os.makedirs(override, exist_ok=True)
        return override
    if sys.platform == "darwin":
        base = os.path.expanduser("~/Library/Application Support")
    elif os.name == "nt":
        base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~\\AppData\\Local")
    else:
        base = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
    d = os.path.join(base, APP_NAME)
    os.makedirs(d, exist_ok=True)
    return d


def _analysis_path() -> str:
    return os.path.join(app_data_dir(), "session_analysis.json")


def _overrides_path() -> str:
    return os.path.join(app_data_dir(), "session_overrides.json")


def _atomic_write(path: str, data: dict) -> None:
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f)
    os.replace(tmp, path)


def save_analysis(state) -> None:
    """Persist the full analysis result (called once when a run completes)."""
    try:
        _atomic_write(_analysis_path(), {
            "version": 1,
            "saved_at": time.time(),
            "input_folders": state.input_folders,
            "merge_mode": state.merge_mode,
            "output_dir": state.output_dir,
            "analyses": state.analyses,
            "destinations": state.destinations,
            "groups": state.groups,
            "path_to_group": state.path_to_group,
        })
    except OSError:
        pass


def save_overrides(state) -> None:
    """Persist just the overrides map (called after every review action)."""
    try:
        _atomic_write(_overrides_path(), {
            "version": 1,
            "saved_at": time.time(),
            "overrides": state.overrides,
        })
    except OSError:
        pass


def load_into(state) -> bool:
    """Load a saved session from disk into ``state``.

    Returns True if a resumable analysis was restored. Sets
    ``state.loaded_from_disk`` and ``state.saved_at`` accordingly."""
    apath = _analysis_path()
    if not os.path.isfile(apath):
        return False
    try:
        with open(apath, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return False
    if not data.get("analyses"):
        return False

    state.input_folders = data.get("input_folders", [])
    state.merge_mode = data.get("merge_mode", True)
    state.output_dir = data.get("output_dir", "./output")
    state.analyses = data.get("analyses", {})
    state.destinations = data.get("destinations", {})
    state.groups = data.get("groups", {})
    state.path_to_group = data.get("path_to_group", {})

    overrides = {}
    opath = _overrides_path()
    if os.path.isfile(opath):
        try:
            with open(opath, encoding="utf-8") as f:
                overrides = json.load(f).get("overrides", {})
        except (OSError, ValueError):
            overrides = {}
    state.overrides = overrides
    state.saved_at = data.get("saved_at")
    state.loaded_from_disk = True
    return True


def clear() -> None:
    """Delete persisted session files."""
    for p in (_analysis_path(), _overrides_path()):
        try:
            os.remove(p)
        except OSError:
            pass
