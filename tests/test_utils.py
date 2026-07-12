"""Tests for culling.utils file scanning and image loading."""

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from culling.utils import list_jpeg_files, count_scannable, load_and_resize


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


class TestExifOrientation:
    def test_orientation_applied_on_load(self, tmp_path):
        # A clearly landscape image (stored 60 wide x 30 tall).
        base = Image.new("RGB", (60, 30), "black")

        plain = str(tmp_path / "plain.jpg")
        base.save(plain, quality=95)

        exif = base.getexif()
        exif[274] = 6  # EXIF Orientation = rotate 90° CW to display upright
        rotated = str(tmp_path / "rot.jpg")
        base.save(rotated, exif=exif, quality=95)

        plain_img = load_and_resize(plain, max_edge=1000)
        rot_img = load_and_resize(rotated, max_edge=1000)

        # Plain: array is (H, W) = (30, 60).
        assert plain_img.shape[:2] == (30, 60)
        # Orientation 6 must swap dimensions to displayed (30 wide x 60 tall)
        # → array (60, 30). If the tag were ignored (old cv2.imread path) this
        # would still be (30, 60) and the test would fail.
        assert rot_img.shape[:2] == (60, 30)

    def test_corrupt_file_returns_none(self, tmp_path):
        bad = str(tmp_path / "broken.jpg")
        with open(bad, "wb") as f:
            f.write(b"not a real jpeg")
        assert load_and_resize(bad) is None
