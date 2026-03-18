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
    lock: threading.Lock = field(default_factory=threading.Lock)


state = SessionState()
