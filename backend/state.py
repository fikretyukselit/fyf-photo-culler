import threading
from dataclasses import dataclass, field


@dataclass
class SessionState:
    input_folders: list = field(default_factory=list)
    merge_mode: bool = True
    output_dir: str = "./output"
    analyses: dict = field(default_factory=dict)       # path -> analysis result
    destinations: dict = field(default_factory=dict)    # path -> destination category
    overrides: dict = field(default_factory=dict)       # path -> user override category
    groups: dict = field(default_factory=dict)          # group_id -> group dict
    path_to_group: dict = field(default_factory=dict)   # path -> group_id
    progress: dict = field(default_factory=lambda: {
        "stage": "idle",
        "current": 0,
        "total": 0,
        "pct": 0,
        "current_file": "",
        "stages": {}
    })
    thumbnail_cache_dir: str = ".thumbnails"
    is_running: bool = False
    cancel_requested: bool = False
    # Session persistence bookkeeping
    loaded_from_disk: bool = False   # True when active state was restored from a saved session
    saved_at: float = None           # Unix timestamp of the restored session, if any
    # Undo/redo: each entry maps path -> previous override value (None = was unset)
    undo_stack: list = field(default_factory=list)
    redo_stack: list = field(default_factory=list)
    lock: threading.Lock = field(default_factory=threading.Lock)


state = SessionState()
