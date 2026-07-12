"""Tests for the parallelized technical-analysis stage in backend.routes.analysis.

The full threaded pipeline needs real image files, so these tests exercise the
extracted helper ``_analyze_files_parallel`` against tiny JPEGs written to disk
with cv2 (same approach as tests/test_duplicates.py / tests/test_utils.py).
Because analysis runs across a thread pool, ordering is nondeterministic — all
assertions are on sets and counts, never order.
"""

import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.routes import analysis as analysis_mod
from backend.state import state


def _textured_image(seed: int, h: int = 64, w: int = 64) -> np.ndarray:
    """A small gray canvas with seeded random shapes — sharp enough that
    analyze_photo returns a real analysis rather than treating it as unreadable."""
    rng = np.random.default_rng(seed)
    img = np.full((h, w, 3), 128, dtype=np.uint8)
    for _ in range(20):
        x, y = int(rng.integers(0, w)), int(rng.integers(0, h))
        size = int(rng.integers(4, 16))
        color = tuple(int(c) for c in rng.integers(0, 256, size=3))
        cv2.rectangle(img, (x, y), (x + size, y + size), color, -1)
    return img


def _write_jpeg(tmp_path, name: str, seed: int) -> str:
    path = str(tmp_path / name)
    cv2.imwrite(path, _textured_image(seed), [cv2.IMWRITE_JPEG_QUALITY, 95])
    return os.path.abspath(path)


def _reset_cancel():
    state.cancel_requested = False


def test_one_analysis_entry_per_readable_file(tmp_path):
    _reset_cancel()
    files = [_write_jpeg(tmp_path, f"p{i}.jpg", seed=i) for i in range(5)]

    analyses, skipped, cancelled = analysis_mod._analyze_files_parallel(files)

    assert cancelled is False
    assert skipped == []
    # Every readable file produced exactly one analysis, keyed by its path.
    assert set(analyses.keys()) == set(files)
    assert len(analyses) == len(files)
    for path, result in analyses.items():
        assert result["path"] == path
        assert "quality_score" in result


def test_corrupt_file_lands_in_skipped(tmp_path):
    _reset_cancel()
    good = [_write_jpeg(tmp_path, f"good{i}.jpg", seed=100 + i) for i in range(3)]

    # A file with a .jpg extension that is not a valid image → analyze_photo
    # returns None (load_and_resize fails) → it must land in skipped.
    corrupt = str(tmp_path / "corrupt.jpg")
    with open(corrupt, "wb") as f:
        f.write(b"not a real jpeg, just bytes")
    corrupt = os.path.abspath(corrupt)

    files = good + [corrupt]
    analyses, skipped, cancelled = analysis_mod._analyze_files_parallel(files)

    assert cancelled is False
    assert set(analyses.keys()) == set(good)
    assert skipped == [corrupt]
    # Readable + skipped together account for every input file exactly once.
    assert len(analyses) + len(skipped) == len(files)


def test_cancel_stops_and_reports_cancelled(tmp_path):
    files = [_write_jpeg(tmp_path, f"c{i}.jpg", seed=200 + i) for i in range(5)]

    # Cancel already requested before we start consuming results.
    state.cancel_requested = True
    try:
        analyses, skipped, cancelled = analysis_mod._analyze_files_parallel(files)
    finally:
        _reset_cancel()

    assert cancelled is True
    # We bail out of the as_completed loop, so no results are collected.
    assert analyses == {}
    assert skipped == []


def _spy_pool(monkeypatch, captured):
    """Patch ThreadPoolExecutor to record the max_workers it was constructed with."""
    real_pool = analysis_mod.ThreadPoolExecutor

    def spy(max_workers=None, **kw):
        captured["max_workers"] = max_workers
        return real_pool(max_workers=max_workers, **kw)

    monkeypatch.setattr(analysis_mod, "ThreadPoolExecutor", spy)


def test_worker_count_capped_at_eight(tmp_path, monkeypatch):
    # min(8, cpu_count): a big machine still caps at 8.
    _reset_cancel()
    captured = {}
    _spy_pool(monkeypatch, captured)
    monkeypatch.setattr(analysis_mod.os, "cpu_count", lambda: 32)
    analysis_mod._analyze_files_parallel([_write_jpeg(tmp_path, "w.jpg", seed=1)])
    assert captured["max_workers"] == 8


def test_worker_count_follows_small_cpu(tmp_path, monkeypatch):
    # Fewer cores than the cap → use the core count.
    _reset_cancel()
    captured = {}
    _spy_pool(monkeypatch, captured)
    monkeypatch.setattr(analysis_mod.os, "cpu_count", lambda: 2)
    analysis_mod._analyze_files_parallel([_write_jpeg(tmp_path, "w.jpg", seed=1)])
    assert captured["max_workers"] == 2


def test_worker_exception_lands_in_skipped(tmp_path, monkeypatch):
    # A worker that raises (e.g. file deleted mid-run) must not abort the whole
    # run — that one file goes to skipped, the rest still succeed.
    _reset_cancel()
    good = _write_jpeg(tmp_path, "ok.jpg", seed=1)
    boom = _write_jpeg(tmp_path, "boom.jpg", seed=2)

    real = analysis_mod.analyze_photo

    def flaky(path, *args, **kwargs):
        if path == boom:
            raise RuntimeError("file vanished mid-analysis")
        return real(path, *args, **kwargs)

    monkeypatch.setattr(analysis_mod, "analyze_photo", flaky)

    analyses, skipped, cancelled = analysis_mod._analyze_files_parallel([good, boom])

    assert cancelled is False
    assert good in analyses
    assert boom in skipped
