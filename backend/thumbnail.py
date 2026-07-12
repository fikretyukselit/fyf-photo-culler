from culling.utils import generate_thumbnail, generate_preview
from backend.state import state


def get_thumbnail(path: str) -> str:
    return generate_thumbnail(path, state.thumbnail_cache_dir)


def get_preview(path: str) -> str:
    return generate_preview(path, state.thumbnail_cache_dir)
