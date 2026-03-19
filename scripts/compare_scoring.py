#!/usr/bin/env python3
"""A/B comparison of OLD vs NEW scoring algorithms.

Usage:
    python scripts/compare_scoring.py /path/to/photos/

Runs both the old (inline replica) and new algorithms on every JPEG in the
given directory and prints a summary of tier changes, auto-reject deltas,
and per-photo score diffs.
"""

import json
import os
import sys

import cv2
import numpy as np

# ---------------------------------------------------------------------------
# Shared helpers — reuse from the project
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from culling.utils import load_and_resize, extract_exif, list_jpeg_files
from culling.technical import (
    compute_contrast,
    compute_exif_score,
    compute_quality_score,
    classify_tier,
    BLUR_THRESHOLD_SHALLOW_DOF,
    SHALLOW_DOF_APERTURE,
    DARK_PIXEL_THRESHOLD,
    BRIGHT_PIXEL_THRESHOLD,
    BRIGHT_RATIO_THRESHOLD,
    _get_aperture,
)

# ---------------------------------------------------------------------------
# OLD algorithm replicas (before this PR)
# ---------------------------------------------------------------------------
OLD_BLUR_THRESHOLD = 100


def old_compute_sharpness(img: np.ndarray) -> float:
    """Center-50% crop Laplacian variance (the old approach)."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    y1, y2 = h // 4, 3 * h // 4
    x1, x2 = w // 4, 3 * w // 4
    center = gray[y1:y2, x1:x2]
    return float(cv2.Laplacian(center, cv2.CV_64F).var())


def old_compute_exposure(img: np.ndarray) -> float:
    """Original exposure — 1:1 dark penalty."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    total = gray.size
    dark_ratio = np.sum(gray < DARK_PIXEL_THRESHOLD) / total
    bright_ratio = np.sum(gray > BRIGHT_PIXEL_THRESHOLD) / total
    mid_ratio = 1.0 - dark_ratio - bright_ratio
    return float(np.clip(mid_ratio * 100, 0, 100))


# ---------------------------------------------------------------------------
# NEW algorithm — imported from the module
# ---------------------------------------------------------------------------
from culling.technical import (
    compute_sharpness as new_compute_sharpness,
    compute_exposure as new_compute_exposure,
    BLUR_THRESHOLD as NEW_BLUR_THRESHOLD,
)


def _auto_reject(sharpness_raw: float, blur_threshold: float,
                 img: np.ndarray) -> tuple:
    """Determine auto-reject status. Returns (auto_reject, reason)."""
    if sharpness_raw < blur_threshold:
        return True, "blurry"
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    total = gray.size
    if np.sum(gray > BRIGHT_PIXEL_THRESHOLD) / total > BRIGHT_RATIO_THRESHOLD:
        return True, "overexposed"
    return False, None


def analyze_old(path: str, img: np.ndarray) -> dict:
    sharpness = old_compute_sharpness(img)
    exposure = old_compute_exposure(img)
    contrast = compute_contrast(img)
    exif = extract_exif(path)
    exif_score = compute_exif_score(exif)

    aperture = _get_aperture(path)
    threshold = BLUR_THRESHOLD_SHALLOW_DOF if (
        aperture is not None and aperture <= SHALLOW_DOF_APERTURE
    ) else OLD_BLUR_THRESHOLD

    auto_reject, reason = _auto_reject(sharpness, threshold, img)
    quality = compute_quality_score(sharpness, exposure, contrast, exif_score)
    tier = classify_tier(quality, auto_reject)
    return {
        "sharpness": round(sharpness, 2),
        "exposure": round(exposure, 2),
        "contrast": round(contrast, 2),
        "quality_score": round(quality, 2),
        "tier": tier,
        "auto_reject": auto_reject,
        "reject_reason": reason,
    }


def analyze_new(path: str, img: np.ndarray) -> dict:
    sharpness = new_compute_sharpness(img)
    exposure = new_compute_exposure(img)
    contrast = compute_contrast(img)
    exif = extract_exif(path)
    exif_score = compute_exif_score(exif)

    aperture = _get_aperture(path)
    threshold = BLUR_THRESHOLD_SHALLOW_DOF if (
        aperture is not None and aperture <= SHALLOW_DOF_APERTURE
    ) else NEW_BLUR_THRESHOLD

    auto_reject, reason = _auto_reject(sharpness, threshold, img)
    quality = compute_quality_score(sharpness, exposure, contrast, exif_score)
    tier = classify_tier(quality, auto_reject)
    return {
        "sharpness": round(sharpness, 2),
        "exposure": round(exposure, 2),
        "contrast": round(contrast, 2),
        "quality_score": round(quality, 2),
        "tier": tier,
        "auto_reject": auto_reject,
        "reject_reason": reason,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
TIER_ORDER = {"unacceptable": 0, "marginal": 1, "good": 2}


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/compare_scoring.py /path/to/photos/")
        sys.exit(1)

    photo_dir = sys.argv[1]
    if not os.path.isdir(photo_dir):
        print(f"Error: {photo_dir} is not a directory")
        sys.exit(1)

    files = list_jpeg_files(photo_dir)
    if not files:
        print("No JPEG files found.")
        sys.exit(1)

    print(f"Comparing OLD vs NEW scoring on {len(files)} photos...\n")

    upgrades = []
    downgrades = []
    saved_from_reject = []
    newly_rejected = []
    results = []

    for path in files:
        img = load_and_resize(path, max_edge=1024)
        if img is None:
            continue

        fname = os.path.basename(path)
        old = analyze_old(path, img)
        new = analyze_new(path, img)

        delta_quality = new["quality_score"] - old["quality_score"]
        delta_sharpness = new["sharpness"] - old["sharpness"]
        delta_exposure = new["exposure"] - old["exposure"]

        old_tier_num = TIER_ORDER[old["tier"]]
        new_tier_num = TIER_ORDER[new["tier"]]

        record = {
            "file": fname,
            "old": old,
            "new": new,
            "delta_quality": round(delta_quality, 2),
            "delta_sharpness": round(delta_sharpness, 2),
            "delta_exposure": round(delta_exposure, 2),
        }
        results.append(record)

        if new_tier_num > old_tier_num:
            upgrades.append(record)
        elif new_tier_num < old_tier_num:
            downgrades.append(record)

        if old["auto_reject"] and not new["auto_reject"]:
            saved_from_reject.append(record)
        elif not old["auto_reject"] and new["auto_reject"]:
            newly_rejected.append(record)

    # Print summary
    print("=" * 70)
    print(f"  TOTAL PHOTOS ANALYZED: {len(results)}")
    print(f"  Tier upgrades:         {len(upgrades)}")
    print(f"  Tier downgrades:       {len(downgrades)}")
    print(f"  Saved from reject:     {len(saved_from_reject)}")
    print(f"  Newly rejected:        {len(newly_rejected)}")
    print("=" * 70)

    if upgrades:
        print(f"\n--- TIER UPGRADES ({len(upgrades)}) ---")
        for r in upgrades:
            print(f"  {r['file']}: {r['old']['tier']} -> {r['new']['tier']}  "
                  f"(quality {r['old']['quality_score']} -> {r['new']['quality_score']}, "
                  f"sharp {r['old']['sharpness']} -> {r['new']['sharpness']}, "
                  f"exp {r['old']['exposure']} -> {r['new']['exposure']})")

    if downgrades:
        print(f"\n--- TIER DOWNGRADES ({len(downgrades)}) --- [REVIEW THESE!]")
        for r in downgrades:
            print(f"  {r['file']}: {r['old']['tier']} -> {r['new']['tier']}  "
                  f"(quality {r['old']['quality_score']} -> {r['new']['quality_score']}, "
                  f"sharp {r['old']['sharpness']} -> {r['new']['sharpness']}, "
                  f"exp {r['old']['exposure']} -> {r['new']['exposure']})")

    if saved_from_reject:
        print(f"\n--- SAVED FROM AUTO-REJECT ({len(saved_from_reject)}) ---")
        for r in saved_from_reject:
            print(f"  {r['file']}: was={r['old']['reject_reason']}, "
                  f"now tier={r['new']['tier']}  "
                  f"(sharp {r['old']['sharpness']} -> {r['new']['sharpness']})")

    if newly_rejected:
        print(f"\n--- NEWLY AUTO-REJECTED ({len(newly_rejected)}) --- [REVIEW THESE!]")
        for r in newly_rejected:
            print(f"  {r['file']}: reason={r['new']['reject_reason']}  "
                  f"(sharp {r['old']['sharpness']} -> {r['new']['sharpness']})")

    # Write full JSON report
    report_path = os.path.join(photo_dir, "scoring_comparison.json")
    with open(report_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nFull per-photo report written to: {report_path}")


if __name__ == "__main__":
    main()
