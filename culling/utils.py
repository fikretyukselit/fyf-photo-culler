import os
import logging
import shutil
from typing import Optional

import cv2
import numpy as np
from PIL import Image
from PIL.ExifTags import TAGS

logger = logging.getLogger(__name__)


def load_and_resize(path: str, max_edge: int = 1024) -> Optional[np.ndarray]:
    """Load a JPEG and resize so the long edge equals max_edge.
    Returns BGR numpy array, or None if the file is corrupt."""
    try:
        img = cv2.imread(path)
        if img is None:
            logger.warning(f"Could not read image: {path}")
            return None
        h, w = img.shape[:2]
        scale = max_edge / max(h, w)
        if scale < 1.0:
            new_w = int(w * scale)
            new_h = int(h * scale)
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
        return img
    except Exception as e:
        logger.warning(f"Error loading {path}: {e}")
        return None


def extract_exif(path: str) -> dict:
    """Extract ISO and shutter speed from EXIF data.
    Returns dict with 'iso' and 'shutter_speed' keys (None if missing)."""
    result = {"iso": None, "shutter_speed": None}
    try:
        with Image.open(path) as img:
            exif_data = img._getexif()
            if exif_data is None:
                return result
            tag_map = {v: k for k, v in TAGS.items()}
            iso_tag = tag_map.get("ISOSpeedRatings")
            if iso_tag and iso_tag in exif_data:
                result["iso"] = exif_data[iso_tag]
            exposure_tag = tag_map.get("ExposureTime")
            if exposure_tag and exposure_tag in exif_data:
                val = exif_data[exposure_tag]
                if hasattr(val, "numerator"):
                    result["shutter_speed"] = val.numerator / val.denominator
                else:
                    result["shutter_speed"] = float(val)
    except Exception as e:
        logger.warning(f"Error reading EXIF from {path}: {e}")
    return result


def list_jpeg_files(directory: str) -> list:
    """List all JPEG files in a directory (non-recursive).
    Returns sorted list of absolute paths. Skips non-JPEG files silently."""
    jpeg_extensions = {".jpg", ".jpeg"}
    files = []
    for entry in os.listdir(directory):
        ext = os.path.splitext(entry)[1].lower()
        if ext in jpeg_extensions:
            full_path = os.path.join(directory, entry)
            if os.path.isfile(full_path):
                files.append(os.path.abspath(full_path))
    return sorted(files)


def safe_copy(src: str, dest_dir: str) -> str:
    """Copy a file to dest_dir, handling name collisions by appending _2, _3, etc.
    Returns the final destination path."""
    os.makedirs(dest_dir, exist_ok=True)
    basename = os.path.basename(src)
    name, ext = os.path.splitext(basename)
    dest = os.path.join(dest_dir, basename)
    counter = 2
    while os.path.exists(dest):
        dest = os.path.join(dest_dir, f"{name}_{counter}{ext}")
        counter += 1
    shutil.copy2(src, dest)
    return dest


def list_jpeg_files_multi(directories: list) -> dict:
    """List JPEG files from multiple directories.
    Returns dict keyed by directory path -> list of absolute paths."""
    result = {}
    for d in directories:
        result[d] = list_jpeg_files(d)
    return result


def generate_thumbnail(path: str, cache_dir: str, max_edge: int = 300) -> str:
    """Generate a thumbnail and cache it. Returns path to cached thumbnail.
    Cache key is MD5 hash of the original file path."""
    import hashlib
    os.makedirs(cache_dir, exist_ok=True)
    key = hashlib.md5(path.encode()).hexdigest()
    cache_path = os.path.join(cache_dir, f"{key}.jpg")
    if os.path.exists(cache_path):
        return cache_path
    img = load_and_resize(path, max_edge=max_edge)
    if img is None:
        raise ValueError(f"Could not load image: {path}")
    cv2.imwrite(cache_path, img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return cache_path
