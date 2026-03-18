from culling.utils import generate_thumbnail
from backend.state import state


def get_thumbnail(path: str) -> str:
    return generate_thumbnail(path, state.thumbnail_cache_dir)
