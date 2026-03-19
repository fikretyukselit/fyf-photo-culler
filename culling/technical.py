import math
import logging
import os
from typing import Optional

import cv2
import numpy as np

from culling.utils import load_and_resize, extract_exif

logger = logging.getLogger(__name__)

W_SHARPNESS = 0.40
W_EXPOSURE = 0.25
W_CONTRAST = 0.15
W_EXIF = 0.20

W_SHARPNESS_NO_EXIF = 0.53
W_EXPOSURE_NO_EXIF = 0.33
W_CONTRAST_NO_EXIF = 0.14

BLUR_THRESHOLD = 85
BLUR_THRESHOLD_SHALLOW_DOF = 50  # Lower threshold for wide aperture (bokeh) shots
SHALLOW_DOF_APERTURE = 4.0       # f/4.0 and below = shallow depth of field

DARK_PIXEL_THRESHOLD = 30
BRIGHT_PIXEL_THRESHOLD = 225
DARK_RATIO_THRESHOLD = 0.85
BRIGHT_RATIO_THRESHOLD = 0.80


def compute_sharpness(img: np.ndarray) -> float:
    """3x3 grid Laplacian variance, returning the average of the top-2 sharpest tiles.
    This catches off-center subjects (rule-of-thirds) while requiring two distinct
    sharp regions — robust against single-tile anomalies like scoreboards."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    tile_h, tile_w = h // 3, w // 3
    variances = []
    for row in range(3):
        for col in range(3):
            y1, y2 = row * tile_h, (row + 1) * tile_h if row < 2 else h
            x1, x2 = col * tile_w, (col + 1) * tile_w if col < 2 else w
            tile = gray[y1:y2, x1:x2]
            variances.append(float(cv2.Laplacian(tile, cv2.CV_64F).var()))
    variances.sort(reverse=True)
    return (variances[0] + variances[1]) / 2.0


def compute_exposure(img: np.ndarray) -> float:
    """Score 0-100. Penalizes mostly dark or mostly bright images.
    Dark pixel penalty is halved — FRC arenas have 40-60% dark background
    (tribunes, floor) which is by design, not a quality issue."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    total = gray.size
    dark_ratio = float(np.sum(gray < DARK_PIXEL_THRESHOLD) / total)
    bright_ratio = float(np.sum(gray > BRIGHT_PIXEL_THRESHOLD) / total)
    effective_dark = dark_ratio * 0.5
    mid_ratio = 1.0 - effective_dark - bright_ratio
    return float(np.clip(mid_ratio * 100, 0, 100))


def compute_contrast(img: np.ndarray) -> float:
    """RMS contrast normalized to 0-100."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float64)
    rms = np.std(gray)
    return float(np.clip(rms / 75 * 100, 0, 100))


def compute_exif_score(exif: dict) -> Optional[float]:
    """Score 0-100 from ISO and shutter speed. None if both missing."""
    iso = exif.get("iso")
    shutter = exif.get("shutter_speed")
    if iso is None and shutter is None:
        return None

    scores = []
    if iso is not None:
        iso_score = max(0, min(100, (6400 - iso) / (6400 - 100) * 100))
        scores.append(iso_score)

    if shutter is not None:
        if shutter <= 0:
            shutter = 0.001
        log_val = math.log10(shutter)
        log_fast = math.log10(1 / 1000)  # -3
        log_slow = math.log10(1 / 30)    # -1.48
        shutter_score = max(0, min(100, (log_val - log_slow) / (log_fast - log_slow) * 100))
        scores.append(shutter_score)

    return sum(scores) / len(scores) if scores else None


def compute_quality_score(sharpness_raw: float, exposure: float, contrast: float,
                          exif_score: Optional[float]) -> float:
    """Weighted quality score 0-100. sharpness_raw is raw Laplacian variance."""
    sharp_norm = min(100, sharpness_raw / 500 * 100)

    if exif_score is not None:
        return (sharp_norm * W_SHARPNESS + exposure * W_EXPOSURE +
                contrast * W_CONTRAST + exif_score * W_EXIF)
    else:
        return (sharp_norm * W_SHARPNESS_NO_EXIF + exposure * W_EXPOSURE_NO_EXIF +
                contrast * W_CONTRAST_NO_EXIF)


def classify_tier(score: float, auto_rejected: bool) -> str:
    if auto_rejected or score < 25:
        return "unacceptable"
    elif score < 50:
        return "marginal"
    else:
        return "good"


def _get_aperture(path: str) -> Optional[float]:
    """Extract f-number from EXIF."""
    try:
        from PIL import Image
        from PIL.ExifTags import TAGS
        with Image.open(path) as img:
            exif = img._getexif()
            if exif is None:
                return None
            tag_map = {v: k for k, v in TAGS.items()}
            fn_tag = tag_map.get("FNumber")
            if fn_tag and fn_tag in exif:
                val = exif[fn_tag]
                return float(val)
    except Exception:
        pass
    return None


def analyze_photo(path: str, blur_threshold: float = BLUR_THRESHOLD) -> Optional[dict]:
    """Full technical analysis of a single photo."""
    img = load_and_resize(path, max_edge=1024)
    if img is None:
        return None

    sharpness_raw = compute_sharpness(img)
    exposure = compute_exposure(img)
    contrast = compute_contrast(img)
    exif = extract_exif(path)
    exif_score = compute_exif_score(exif)

    # Determine effective blur threshold — lower for shallow DOF shots
    aperture = _get_aperture(path)
    if aperture is not None and aperture <= SHALLOW_DOF_APERTURE:
        effective_blur_threshold = BLUR_THRESHOLD_SHALLOW_DOF
    else:
        effective_blur_threshold = blur_threshold

    auto_reject = False
    reject_reason = None

    if sharpness_raw < effective_blur_threshold:
        auto_reject = True
        reject_reason = "blurry"

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    total = gray.size
    # Dark is NOT an auto-reject — indoor/arena photos are naturally dark.
    # Darkness already penalizes quality_score via low exposure sub-score.
    if not auto_reject and np.sum(gray > BRIGHT_PIXEL_THRESHOLD) / total > BRIGHT_RATIO_THRESHOLD:
        auto_reject = True
        reject_reason = "overexposed"

    quality_score = compute_quality_score(sharpness_raw, exposure, contrast, exif_score)
    tier = classify_tier(quality_score, auto_reject)

    return {
        "path": path,
        "quality_score": round(quality_score, 2),
        "tier": tier,
        "auto_reject": auto_reject,
        "reject_reason": reject_reason,
        "sharpness_raw": round(sharpness_raw, 2),
        "exposure": round(exposure, 2),
        "contrast": round(contrast, 2),
        "exif_score": round(exif_score, 2) if exif_score is not None else None,
        "iso": exif.get("iso"),
        "shutter_speed": exif.get("shutter_speed"),
        "aperture": aperture,
        "file_size": os.path.getsize(path),
    }
