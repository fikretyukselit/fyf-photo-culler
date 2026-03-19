"""Tests for culling.technical scoring algorithms."""

import os
import sys

import cv2
import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from culling.technical import (
    compute_sharpness,
    compute_exposure,
    compute_contrast,
    compute_quality_score,
    classify_tier,
    BLUR_THRESHOLD,
    BLUR_THRESHOLD_SHALLOW_DOF,
    DARK_PIXEL_THRESHOLD,
    BRIGHT_PIXEL_THRESHOLD,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_bgr(gray: np.ndarray) -> np.ndarray:
    """Convert a single-channel image to 3-channel BGR for the scoring functions."""
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def _uniform_image(value: int = 128, h: int = 300, w: int = 450) -> np.ndarray:
    """Create a uniform gray image (no edges → sharpness ≈ 0)."""
    gray = np.full((h, w), value, dtype=np.uint8)
    return _make_bgr(gray)


def _edge_image(h: int = 300, w: int = 450) -> np.ndarray:
    """Create an image with strong edges everywhere → high sharpness."""
    gray = np.zeros((h, w), dtype=np.uint8)
    # Alternating black/white stripes every 2 rows
    for i in range(h):
        if i % 4 < 2:
            gray[i, :] = 255
    return _make_bgr(gray)


def _off_center_subject_image(h: int = 300, w: int = 450) -> np.ndarray:
    """Image with a sharp subject in top-left (rule of thirds) on a flat background.
    The old center-crop approach would miss this subject entirely."""
    gray = np.full((h, w), 128, dtype=np.uint8)
    # Place strong edges in top-left tile (row=0, col=0)
    tile_h, tile_w = h // 3, w // 3
    for i in range(tile_h):
        if i % 4 < 2:
            gray[i, :tile_w] = 255
        else:
            gray[i, :tile_w] = 0
    # Also add some edges in top-right tile to give a second sharp tile
    for i in range(tile_h):
        if i % 4 < 2:
            gray[i, 2 * tile_w:] = 255
        else:
            gray[i, 2 * tile_w:] = 0
    return _make_bgr(gray)


# ---------------------------------------------------------------------------
# Unit tests: compute_sharpness (grid-based, top-2 average)
# ---------------------------------------------------------------------------

class TestComputeSharpness:
    def test_uniform_image_near_zero(self):
        """A uniform image has no edges → sharpness should be near 0."""
        img = _uniform_image(128)
        assert compute_sharpness(img) < 1.0

    def test_edge_image_high(self):
        """An image with edges everywhere → high sharpness."""
        img = _edge_image()
        assert compute_sharpness(img) > 500

    def test_off_center_subject_detected(self):
        """Subject in top-left/top-right tiles should produce meaningful sharpness
        even though the center of the image is flat."""
        img = _off_center_subject_image()
        sharpness = compute_sharpness(img)
        # Should be significantly above 0 — the top-2 tiles are sharp
        assert sharpness > 100

    def test_single_sharp_tile_limited(self):
        """Only one sharp tile + 8 flat tiles → top-2 average is limited
        because the second tile is flat."""
        gray = np.full((300, 450), 128, dtype=np.uint8)
        tile_h, tile_w = 100, 150
        # Sharp edges only in top-left tile
        for i in range(tile_h):
            if i % 4 < 2:
                gray[i, :tile_w] = 255
            else:
                gray[i, :tile_w] = 0
        img = _make_bgr(gray)
        sharpness = compute_sharpness(img)
        # Top-2 average = (high + ~0) / 2 → much less than the sharp tile alone
        full_edge = compute_sharpness(_edge_image())
        assert sharpness <= full_edge * 0.5


# ---------------------------------------------------------------------------
# Unit tests: compute_exposure (asymmetric dark penalty)
# ---------------------------------------------------------------------------

class TestComputeExposure:
    def test_mid_gray_high_score(self):
        """A mid-gray image (128) has no dark or bright pixels → score near 100."""
        img = _uniform_image(128)
        score = compute_exposure(img)
        assert score > 90

    def test_dark_image_partial_penalty(self):
        """An all-dark image: dark_ratio=1.0 → effective_dark=0.5 → mid_ratio=0.5 → score=50."""
        img = _uniform_image(10)  # Below DARK_PIXEL_THRESHOLD (30)
        score = compute_exposure(img)
        assert 45 <= score <= 55  # Approximately 50

    def test_bright_image_full_penalty(self):
        """An all-bright image: bright_ratio=1.0 → score=0 (full penalty)."""
        img = _uniform_image(240)  # Above BRIGHT_PIXEL_THRESHOLD (225)
        score = compute_exposure(img)
        assert score < 5

    def test_dark_penalty_halved_vs_bright(self):
        """Dark images should score higher than equally extreme bright images
        due to the halved dark penalty."""
        dark_img = _uniform_image(10)
        bright_img = _uniform_image(240)
        dark_score = compute_exposure(dark_img)
        bright_score = compute_exposure(bright_img)
        assert dark_score > bright_score

    def test_arena_like_image(self):
        """Simulate a 50% dark background + 50% mid-tones (typical arena).
        Old: mid_ratio=0.5 → score=50. New: effective_dark=0.25 → mid_ratio=0.75 → score=75."""
        h, w = 300, 450
        gray = np.full((h, w), 128, dtype=np.uint8)
        gray[:h // 2, :] = 10  # Top half is dark (arena background)
        img = _make_bgr(gray)
        score = compute_exposure(img)
        assert score > 65  # Should be around 75 with new algorithm


# ---------------------------------------------------------------------------
# Unit tests: threshold constants
# ---------------------------------------------------------------------------

class TestThresholds:
    def test_blur_threshold_lowered(self):
        assert BLUR_THRESHOLD == 85

    def test_shallow_dof_threshold_unchanged(self):
        assert BLUR_THRESHOLD_SHALLOW_DOF == 50

    def test_pixel_thresholds_unchanged(self):
        assert DARK_PIXEL_THRESHOLD == 30
        assert BRIGHT_PIXEL_THRESHOLD == 225


# ---------------------------------------------------------------------------
# Unit tests: classify_tier and compute_quality_score
# ---------------------------------------------------------------------------

class TestTierClassification:
    def test_auto_rejected_is_unacceptable(self):
        assert classify_tier(80, auto_rejected=True) == "unacceptable"

    def test_low_score_is_unacceptable(self):
        assert classify_tier(20, auto_rejected=False) == "unacceptable"

    def test_mid_score_is_marginal(self):
        assert classify_tier(35, auto_rejected=False) == "marginal"

    def test_high_score_is_good(self):
        assert classify_tier(60, auto_rejected=False) == "good"


class TestQualityScore:
    def test_with_exif(self):
        score = compute_quality_score(250.0, 80.0, 70.0, 85.0)
        # sharp_norm = min(100, 250/500*100) = 50
        # 50*0.4 + 80*0.25 + 70*0.15 + 85*0.2 = 20+20+10.5+17 = 67.5
        assert abs(score - 67.5) < 0.1

    def test_without_exif(self):
        score = compute_quality_score(250.0, 80.0, 70.0, None)
        # sharp_norm = 50
        # 50*0.53 + 80*0.33 + 70*0.14 = 26.5+26.4+9.8 = 62.7
        assert abs(score - 62.7) < 0.1


# ---------------------------------------------------------------------------
# Integration tests with real photos (skipped if photos not available)
# ---------------------------------------------------------------------------

MUSTAFA_DIR = "/Users/mrkaynak/Downloads/mustafa/"


def _have_mustafa_photos():
    return os.path.isdir(MUSTAFA_DIR)


@pytest.mark.skipif(not _have_mustafa_photos(),
                    reason="Mustafa photo dataset not found")
class TestRealPhotos:
    def test_316A3360_not_auto_rejected(self):
        """316A3360 had sharpness=98.02 with old algorithm — was borderline rejected.
        With grid-based sharpness, it should NOT be auto-rejected."""
        from culling.technical import analyze_photo
        # Find the file (may have .jpg or .JPG extension)
        candidates = [f for f in os.listdir(MUSTAFA_DIR)
                      if "316A3360" in f and f.lower().endswith((".jpg", ".jpeg"))]
        assert candidates, "316A3360 photo not found in mustafa dataset"
        path = os.path.join(MUSTAFA_DIR, candidates[0])
        result = analyze_photo(path)
        assert result is not None
        assert not result["auto_reject"], (
            f"316A3360 should NOT be auto-rejected, got sharpness={result['sharpness_raw']}"
        )

    def test_316A3375_still_auto_rejected(self):
        """316A3375 is a genuinely blurry photo — must remain auto-rejected."""
        from culling.technical import analyze_photo
        candidates = [f for f in os.listdir(MUSTAFA_DIR)
                      if "316A3375" in f and f.lower().endswith((".jpg", ".jpeg"))]
        if not candidates:
            pytest.skip("316A3375 photo not found in mustafa dataset")
        path = os.path.join(MUSTAFA_DIR, candidates[0])
        result = analyze_photo(path)
        assert result is not None
        assert result["auto_reject"], (
            f"316A3375 should be auto-rejected (genuinely blurry), "
            f"got sharpness={result['sharpness_raw']}"
        )

    def test_good_photos_stay_good(self):
        """Spot-check: photos with high old scores should remain 'good' tier."""
        from culling.technical import analyze_photo
        from culling.utils import list_jpeg_files

        files = list_jpeg_files(MUSTAFA_DIR)[:20]  # Check first 20
        good_count = 0
        for path in files:
            result = analyze_photo(path)
            if result and result["quality_score"] >= 60:
                good_count += 1
                assert result["tier"] == "good", (
                    f"{os.path.basename(path)}: score={result['quality_score']} "
                    f"but tier={result['tier']}"
                )
        # Sanity: at least some photos should be good
        assert good_count > 0, "No photos scored above 60 — something may be wrong"
