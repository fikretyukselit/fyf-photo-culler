"""Tests for culling.duplicates grouping and burst time-window pruning."""

import os
import shutil
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from culling.duplicates import (
    detect_duplicates_and_similar,
    find_pairs,
    compute_phash,
    BURST_TIME_WINDOW,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _textured_image(seed: int, h: int = 480, w: int = 640) -> np.ndarray:
    """A gray canvas with seeded random filled shapes.

    The corners and edges give ORB plenty (>=10) of keypoints to latch onto,
    so verified similar pairs are reliably detected."""
    rng = np.random.default_rng(seed)
    img = np.full((h, w, 3), 128, dtype=np.uint8)
    for _ in range(40):
        x, y = int(rng.integers(0, w)), int(rng.integers(0, h))
        size = int(rng.integers(20, 80))
        color = tuple(int(c) for c in rng.integers(0, 256, size=3))
        if rng.integers(0, 2):
            cv2.rectangle(img, (x, y), (x + size, y + size), color, -1)
        else:
            cv2.circle(img, (x, y), size // 2, color, -1)
    return img


def _write(path: str, img: np.ndarray) -> str:
    cv2.imwrite(path, img, [cv2.IMWRITE_JPEG_QUALITY, 95])
    return os.path.abspath(path)


def _analysis(quality_score, file_size=1_000_000, datetime_original=None):
    return {
        "quality_score": quality_score,
        "file_size": file_size,
        "datetime_original": datetime_original,
    }


# ---------------------------------------------------------------------------
# Grouping: duplicate, similar, unrelated
# ---------------------------------------------------------------------------

class TestGrouping:
    def _build(self, tmp_path):
        base = _textured_image(seed=1)
        orig = _write(str(tmp_path / "orig.jpg"), base)

        # Exact byte copy → duplicate.
        dup = str(tmp_path / "dup.jpg")
        shutil.copy(orig, dup)
        dup = os.path.abspath(dup)

        # Same scene shifted a few pixels → similar/burst.
        shifted = _write(str(tmp_path / "shift.jpg"), np.roll(base, 6, axis=1))

        # Completely different pattern → should not group.
        other = _write(str(tmp_path / "other.jpg"), _textured_image(seed=999))

        paths = [orig, dup, shifted, other]
        analyses = {
            orig: _analysis(90.0),
            dup: _analysis(80.0),
            shifted: _analysis(70.0),
            other: _analysis(60.0),
        }
        return paths, analyses, orig, dup, shifted, other

    def test_duplicate_grouped_and_best_kept(self, tmp_path):
        paths, analyses, orig, dup, shifted, other = self._build(tmp_path)
        keep, reject, groups = detect_duplicates_and_similar(paths, analyses)

        # The exact copy must be rejected as a duplicate...
        assert reject.get(dup) == "duplicate"
        # ...and the higher-scoring original kept.
        assert orig in keep

        # orig and dup share a group whose best is the kept original.
        dup_group = next(g for g in groups if dup in g["members"])
        assert orig in dup_group["members"]
        assert dup_group["best"] == orig
        assert dup_group["best"] in keep

    def test_shifted_frame_grouped(self, tmp_path):
        paths, analyses, orig, dup, shifted, other = self._build(tmp_path)
        keep, reject, groups = detect_duplicates_and_similar(paths, analyses)

        # The shifted frame is grouped with the original scene.
        shift_group = next(g for g in groups if shifted in g["members"])
        assert orig in shift_group["members"]
        # kind is "similar", or "duplicate" if union-find merged it with the
        # exact-duplicate pair — both are acceptable.
        assert shift_group["kind"] in ("similar", "duplicate")
        assert reject.get(shifted) in ("similar", "duplicate")

    def test_unrelated_not_grouped(self, tmp_path):
        paths, analyses, orig, dup, shifted, other = self._build(tmp_path)
        keep, reject, groups = detect_duplicates_and_similar(paths, analyses)

        # The unrelated photo survives verification and joins no group.
        assert other in keep
        assert other not in reject
        assert all(other not in g["members"] for g in groups)

    def test_group_ids_deterministic_and_members_sorted(self, tmp_path):
        paths, analyses, *_ = self._build(tmp_path)
        _, _, groups = detect_duplicates_and_similar(paths, analyses)

        assert groups, "expected at least one group"
        # IDs are g0001, g0002, ... in order.
        assert [g["id"] for g in groups] == [f"g{i:04d}" for i in range(1, len(groups) + 1)]
        # Members within each group are sorted by descending quality score.
        for g in groups:
            scores = [analyses[p]["quality_score"] for p in g["members"]]
            assert scores == sorted(scores, reverse=True)


# ---------------------------------------------------------------------------
# Time-window pruning
# ---------------------------------------------------------------------------

class TestTimeWindow:
    def _two_copies(self, tmp_path, ts1, ts2):
        base = _textured_image(seed=7)
        a = _write(str(tmp_path / "a.jpg"), base)
        b = str(tmp_path / "b.jpg")
        shutil.copy(a, b)
        b = os.path.abspath(b)
        paths = [a, b]
        analyses = {
            a: _analysis(90.0, datetime_original=ts1),
            b: _analysis(80.0, datetime_original=ts2),
        }
        return paths, analyses, a, b

    def test_window_prunes_far_apart_copies(self, tmp_path):
        # Two identical files captured 100s apart must NOT group with a 2s window.
        paths, analyses, a, b = self._two_copies(tmp_path, 1000.0, 1100.0)
        keep, reject, groups = detect_duplicates_and_similar(
            paths, analyses, time_window=BURST_TIME_WINDOW
        )
        assert reject == {}
        assert groups == []
        assert set(keep) == {a, b}

    def test_disabled_window_groups_far_apart_copies(self, tmp_path):
        # Same files, window disabled → they DO group.
        paths, analyses, a, b = self._two_copies(tmp_path, 1000.0, 1100.0)
        keep, reject, groups = detect_duplicates_and_similar(
            paths, analyses, time_window=None
        )
        assert b in reject
        assert len(groups) == 1
        assert set(groups[0]["members"]) == {a, b}

    def test_missing_timestamps_still_compared(self, tmp_path):
        # No timestamps → window cannot prune → identical copies still group.
        paths, analyses, a, b = self._two_copies(tmp_path, None, None)
        keep, reject, groups = detect_duplicates_and_similar(
            paths, analyses, time_window=BURST_TIME_WINDOW
        )
        assert b in reject
        assert len(groups) == 1
        assert set(groups[0]["members"]) == {a, b}


# ---------------------------------------------------------------------------
# find_pairs window semantics (unit level)
# ---------------------------------------------------------------------------

class TestFindPairsWindow:
    def test_none_timestamp_photo_compared_when_window_active(self, tmp_path):
        base = _textured_image(seed=3)
        a = _write(str(tmp_path / "a.jpg"), base)
        b = str(tmp_path / "b.jpg")
        shutil.copy(a, b)
        b = os.path.abspath(b)
        hashes = {a: compute_phash(a), b: compute_phash(b)}

        # a has no timestamp; b is far away. A missing timestamp disables pruning
        # for that pair, so the pair is still produced.
        timestamps = {a: None, b: 9999.0}
        pairs = find_pairs(hashes, threshold=5, timestamps=timestamps, time_window=2.0)
        assert len(pairs) == 1
