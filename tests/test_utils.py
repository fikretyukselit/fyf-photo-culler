"""Tests for culling.utils file scanning (recursive, hidden-dir aware)."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from culling.utils import list_jpeg_files, count_scannable


def _touch(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(b"x")


class TestListJpegFiles:
    def test_finds_files_in_subfolders(self, tmp_path):
        _touch(str(tmp_path / "top.jpg"))
        _touch(str(tmp_path / "DCIM" / "100CANON" / "a.jpg"))
        _touch(str(tmp_path / "DCIM" / "101CANON" / "b.JPEG"))

        found = list_jpeg_files(str(tmp_path))
        names = sorted(os.path.basename(p) for p in found)
        assert names == ["a.jpg", "b.JPEG", "top.jpg"]

    def test_skips_hidden_directories(self, tmp_path):
        _touch(str(tmp_path / "keep.jpg"))
        _touch(str(tmp_path / ".thumbnails" / "cached.jpg"))

        found = list_jpeg_files(str(tmp_path))
        names = [os.path.basename(p) for p in found]
        assert "keep.jpg" in names
        assert "cached.jpg" not in names

    def test_ignores_non_jpeg(self, tmp_path):
        _touch(str(tmp_path / "photo.jpg"))
        _touch(str(tmp_path / "raw.cr2"))
        _touch(str(tmp_path / "note.txt"))

        found = list_jpeg_files(str(tmp_path))
        assert [os.path.basename(p) for p in found] == ["photo.jpg"]

    def test_returns_absolute_sorted_paths(self, tmp_path):
        _touch(str(tmp_path / "b.jpg"))
        _touch(str(tmp_path / "a.jpg"))

        found = list_jpeg_files(str(tmp_path))
        assert all(os.path.isabs(p) for p in found)
        assert found == sorted(found)


class TestCountScannable:
    def test_counts_jpeg_and_other_images_recursively(self, tmp_path):
        _touch(str(tmp_path / "a.jpg"))
        _touch(str(tmp_path / "sub" / "b.jpeg"))
        _touch(str(tmp_path / "sub" / "raw.cr2"))
        _touch(str(tmp_path / "pic.png"))
        _touch(str(tmp_path / "readme.txt"))  # not an image → ignored

        jpg, other = count_scannable(str(tmp_path))
        assert jpg == 2
        assert other == 2  # cr2 + png, txt excluded

    def test_hidden_dirs_excluded_from_counts(self, tmp_path):
        _touch(str(tmp_path / "a.jpg"))
        _touch(str(tmp_path / ".cache" / "b.jpg"))
        _touch(str(tmp_path / ".cache" / "c.png"))

        jpg, other = count_scannable(str(tmp_path))
        assert jpg == 1
        assert other == 0
