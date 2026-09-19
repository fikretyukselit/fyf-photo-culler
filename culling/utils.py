import datetime
import os
import logging
import shutil
import hashlib
import tempfile
from typing import Optional

import cv2
import numpy as np
from PIL import Image, ImageOps
from PIL.ExifTags import TAGS

logger = logging.getLogger(__name__)

JPEG_EXTENSIONS = {".jpg", ".jpeg"}
# Image formats we recognise but do not (yet) analyse — used to tell the user
# how many photos were skipped rather than silently ignoring them.
OTHER_IMAGE_EXTENSIONS = {
    ".png", ".heic", ".heif", ".webp", ".tif", ".tiff", ".bmp", ".gif",
    ".cr2", ".cr3", ".nef", ".arw", ".raf", ".rw2", ".orf", ".dng", ".raw", ".sr2",
}


def load_and_resize(path: str, max_edge: int = 1024) -> Optional[np.ndarray]:
    """Load an image, apply its EXIF orientation, and resize so the long edge
    equals max_edge. Returns a BGR numpy array, or None if the file is corrupt.

    Loading goes through PIL + ImageOps.exif_transpose so that a photo shot in
    portrait (EXIF orientation 6/8) is analysed upright — cv2.imread ignores the
    orientation tag, which made rotated duplicates miss and skewed sharpness/
    exposure. pHash uses the same PIL path (see duplicates.compute_phash), so the
    whole pipeline now sees images the same, correct way up."""
    try:
        with Image.open(path) as pil_img:
            pil_img = ImageOps.exif_transpose(pil_img)
            pil_img = pil_img.convert("RGB")
            # RGB (PIL) -> BGR (the order the rest of the cv2 code expects).
            img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    except Exception as e:
        logger.warning(f"Error loading {path}: {e}")
        return None

    h, w = img.shape[:2]
    scale = max_edge / max(h, w)
    if scale < 1.0:
        new_w = int(w * scale)
        new_h = int(h * scale)
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return img


def extract_exif(path: str) -> dict:
    """Extract ISO, shutter speed and capture timestamp from EXIF data.
    Returns dict with 'iso', 'shutter_speed' and 'datetime_original' keys
    (None if missing). 'datetime_original' is a Unix timestamp (float),
    including sub-second precision when the camera records it."""
    result = {"iso": None, "shutter_speed": None, "datetime_original": None}
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
            dt_tag = tag_map.get("DateTimeOriginal")
            if dt_tag and dt_tag in exif_data:
                try:
                    ts = datetime.datetime.strptime(
                        str(exif_data[dt_tag]).strip(), "%Y:%m:%d %H:%M:%S"
                    ).timestamp()
                    subsec_tag = tag_map.get("SubsecTimeOriginal")
                    if subsec_tag and subsec_tag in exif_data:
                        sub = str(exif_data[subsec_tag]).strip()
                        if sub.isdigit():
                            ts += int(sub) / (10 ** len(sub))
                    result["datetime_original"] = ts
                except (ValueError, TypeError):
                    pass
    except Exception as e:
        logger.warning(f"Error reading EXIF from {path}: {e}")
    return result


def list_jpeg_files(directory: str) -> list:
    """Recursively list all JPEG files under a directory.
    Returns a sorted list of absolute paths. Hidden directories (dotfiles such
    as .thumbnails) are skipped so we never re-scan our own cache."""
    files = []
    for root, dirnames, filenames in os.walk(directory):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for name in filenames:
            ext = os.path.splitext(name)[1].lower()
            if ext in JPEG_EXTENSIONS:
                full_path = os.path.join(root, name)
                if os.path.isfile(full_path):
                    files.append(os.path.abspath(full_path))
    return sorted(files)


def count_scannable(directory: str) -> tuple:
    """Recursively count JPEG files and other (unsupported) image files under a
    directory. Returns (jpg_count, other_image_count). Non-image files and
    hidden directories are ignored so the 'skipped' figure is meaningful."""
    jpg = 0
    other = 0
    for root, dirnames, filenames in os.walk(directory):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for name in filenames:
            ext = os.path.splitext(name)[1].lower()
            if ext in JPEG_EXTENSIONS:
                jpg += 1
            elif ext in OTHER_IMAGE_EXTENSIONS:
                other += 1
    return jpg, other


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


# Derivative sizes: THUMB for grid tiles, PREVIEW for the detail panel /
# loupe. PREVIEW matches the 1024px edge analysis already decodes at, so it
# can be written during analysis without an extra decode.
THUMB_MAX_EDGE = 320
PREVIEW_MAX_EDGE = 1024


def source_version(path: str) -> Optional[str]:
    """Cheap source identity shared by disk derivatives and browser URLs.

    ctime/inode also invalidate replacements that preserve size and mtime.
    This is a cache version, not a cryptographic content fingerprint.
    """
    try:
        st = os.stat(path)
    except OSError:
        return None
    identity = f"v2:{st.st_size}:{st.st_mtime_ns}:{st.st_ctime_ns}:{st.st_ino}"
    return hashlib.sha256(identity.encode()).hexdigest()[:24]


def _cache_key(path: str) -> str:
    return f"{hashlib.md5(path.encode()).hexdigest()}-{source_version(path) or 'missing'}"


def thumbnail_cache_path(path: str, cache_dir: str) -> str:
    return os.path.join(cache_dir, f"{_cache_key(path)}.jpg")


def preview_cache_path(path: str, cache_dir: str) -> str:
    return os.path.join(cache_dir, f"{_cache_key(path)}.preview.jpg")


def _shrink_to(img: np.ndarray, max_edge: int) -> np.ndarray:
    h, w = img.shape[:2]
    scale = max_edge / max(h, w)
    if scale >= 1.0:
        return img
    return cv2.resize(
        img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA
    )


def _write_jpeg_atomic(path: str, img: np.ndarray) -> None:
    """Readers see either a complete JPEG or no file, including under concurrency."""
    fd, temporary = tempfile.mkstemp(suffix=".jpg", dir=os.path.dirname(path))
    os.close(fd)
    try:
        if not cv2.imwrite(temporary, img, [cv2.IMWRITE_JPEG_QUALITY, 85]):
            raise OSError(f"Could not write image derivative: {path}")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def save_derivatives_from_image(
    img: np.ndarray, path: str, cache_dir: str, expected_version: Optional[str] = None,
) -> None:
    """Write the thumbnail and preview for ``path`` from an already-decoded
    image (skipping current versions that exist). Called during analysis, where the image
    is in memory anyway — avoids a second full-resolution decode later."""
    os.makedirs(cache_dir, exist_ok=True)
    if expected_version is not None and source_version(path) != expected_version:
        raise ValueError("Source changed during analysis; derivatives were not cached")
    preview_path = preview_cache_path(path, cache_dir)
    thumb_path = thumbnail_cache_path(path, cache_dir)
    if expected_version is not None and source_version(path) != expected_version:
        raise ValueError("Source changed during analysis; derivatives were not cached")
    if not os.path.exists(preview_path):
        _write_jpeg_atomic(preview_path, _shrink_to(img, PREVIEW_MAX_EDGE))
    if not os.path.exists(thumb_path):
        _write_jpeg_atomic(thumb_path, _shrink_to(img, THUMB_MAX_EDGE))


def _generate_derivative(path: str, cache_path: str, max_edge: int) -> str:
    version = source_version(path)
    if not os.path.basename(cache_path).startswith(f"{_cache_key(path)}."):
        raise ValueError("Source changed before derivative generation")
    if os.path.exists(cache_path):
        return cache_path
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    img = load_and_resize(path, max_edge=max_edge)
    if img is None:
        raise ValueError(f"Could not load image: {path}")
    if source_version(path) != version:
        raise ValueError("Source changed during derivative generation")
    _write_jpeg_atomic(cache_path, img)
    return cache_path


def generate_thumbnail(path: str, cache_dir: str, max_edge: int = THUMB_MAX_EDGE) -> str:
    """Return the cached thumbnail for ``path``, generating it on demand.
    Cache key includes the path and source version."""
    return _generate_derivative(path, thumbnail_cache_path(path, cache_dir), max_edge)


def generate_preview(path: str, cache_dir: str, max_edge: int = PREVIEW_MAX_EDGE) -> str:
    """Return the cached 1024px preview for ``path``, generating it on demand."""
    return _generate_derivative(path, preview_cache_path(path, cache_dir), max_edge)
