"""Tests for photo serving performance features (derivatives, caching) and
folder/sort query params on /api/photos."""

import base64
import io
import os
import sys

import pytest
from fastapi.testclient import TestClient
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.server import app
from backend.state import state
from culling.technical import analyze_photo
from culling.utils import (
    generate_preview,
    preview_cache_path,
    save_derivatives_from_image,
    thumbnail_cache_path,
)


client = TestClient(app)


def _encode_id(path: str) -> str:
    return base64.urlsafe_b64encode(path.encode()).decode()


def _write_jpeg(path, size=(1600, 1200)):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.new("RGB", size, color=(120, 90, 200)).save(path, "JPEG")
    return path


def _analysis(path, score=50.0, destination="keep"):
    state.analyses[path] = {
        "path": path,
        "quality_score": score,
        "tier": "good",
        "sharpness_raw": 200.0,
        "exposure": 80.0,
        "contrast": 70.0,
        "exif_score": None,
        "iso": None,
        "shutter_speed": None,
        "aperture": None,
        "file_size": 1000,
    }
    state.destinations[path] = destination


@pytest.fixture(autouse=True)
def clean_state(tmp_path):
    def _reset():
        state.analyses = {}
        state.destinations = {}
        state.overrides = {}
        state.groups = {}
        state.path_to_group = {}
        state.input_folders = []
        state.undo_stack = []
        state.redo_stack = []

    _reset()
    state.thumbnail_cache_dir = str(tmp_path / ".thumbnails")
    yield
    _reset()
    state.thumbnail_cache_dir = ".thumbnails"


class TestDerivatives:
    def test_failed_image_write_does_not_publish_a_cache_entry(self, tmp_path, monkeypatch):
        import cv2

        photo = _write_jpeg(str(tmp_path / "source.jpg"))
        cache = str(tmp_path / "cache")
        monkeypatch.setattr(cv2, "imwrite", lambda *args: False)
        with pytest.raises(OSError):
            generate_preview(photo, cache)
        assert not os.path.exists(preview_cache_path(photo, cache))
        assert list((tmp_path / "cache").iterdir()) == []

    def test_save_derivatives_writes_thumb_and_preview(self, tmp_path):
        import numpy as np

        img = np.zeros((1024, 768, 3), dtype=np.uint8)
        cache = str(tmp_path / "cache")
        save_derivatives_from_image(img, "/photos/a.jpg", cache)

        assert os.path.exists(thumbnail_cache_path("/photos/a.jpg", cache))
        assert os.path.exists(preview_cache_path("/photos/a.jpg", cache))

    def test_thumbnail_long_edge_is_bounded(self, tmp_path):
        import numpy as np

        img = np.zeros((1024, 768, 3), dtype=np.uint8)
        cache = str(tmp_path / "cache")
        save_derivatives_from_image(img, "/photos/a.jpg", cache)

        with Image.open(thumbnail_cache_path("/photos/a.jpg", cache)) as thumb:
            assert max(thumb.size) == 320

    def test_analyze_photo_writes_derivatives(self, tmp_path):
        photo = _write_jpeg(str(tmp_path / "src" / "img.jpg"))
        cache = str(tmp_path / "cache")

        result = analyze_photo(photo, thumbnail_dir=cache)

        assert result is not None
        assert os.path.exists(thumbnail_cache_path(photo, cache))
        assert os.path.exists(preview_cache_path(photo, cache))

    def test_analyze_photo_survives_unwritable_thumbnail_dir(self, tmp_path):
        photo = _write_jpeg(str(tmp_path / "src" / "img.jpg"))
        blocked = str(tmp_path / "blocked")
        # A file where the cache dir should be makes makedirs fail.
        with open(blocked, "w") as f:
            f.write("x")

        assert analyze_photo(photo, thumbnail_dir=blocked) is not None

    def test_generate_preview_on_demand(self, tmp_path):
        photo = _write_jpeg(str(tmp_path / "src" / "img.jpg"))
        cache = str(tmp_path / "cache")

        out = generate_preview(photo, cache)

        assert out == preview_cache_path(photo, cache)
        with Image.open(out) as preview:
            assert max(preview.size) == 1024


class TestImageCaching:
    def test_unversioned_thumbnail_revalidates_and_has_etag(self, tmp_path):
        photo = _write_jpeg(str(tmp_path / "src" / "img.jpg"))
        _analysis(photo)

        res = client.get(f"/api/photos/{_encode_id(photo)}/thumbnail")

        assert res.status_code == 200
        assert res.headers["cache-control"] == "no-cache"
        assert res.headers.get("etag")

    def test_if_none_match_returns_304(self, tmp_path):
        photo = _write_jpeg(str(tmp_path / "src" / "img.jpg"))
        _analysis(photo)
        pid = _encode_id(photo)

        first = client.get(f"/api/photos/{pid}/thumbnail")
        etag = first.headers["etag"]
        second = client.get(
            f"/api/photos/{pid}/thumbnail", headers={"If-None-Match": etag}
        )

        assert second.status_code == 304
        assert second.content == b""

    def test_preview_endpoint_serves_1024px_jpeg(self, tmp_path):
        photo = _write_jpeg(str(tmp_path / "src" / "img.jpg"))
        _analysis(photo)

        res = client.get(f"/api/photos/{_encode_id(photo)}/preview")

        assert res.status_code == 200
        assert res.headers["content-type"] == "image/jpeg"
        assert res.headers["cache-control"] == "no-cache"

    def test_full_image_gets_cache_headers(self, tmp_path):
        photo = _write_jpeg(str(tmp_path / "src" / "img.jpg"))
        _analysis(photo)

        res = client.get(f"/api/photos/{_encode_id(photo)}/full")

        assert res.status_code == 200
        assert res.headers["cache-control"] == "no-cache"

    @pytest.mark.parametrize("kind", ["thumbnail", "preview", "full"])
    def test_replacing_source_refreshes_pixels_and_browser_version(self, tmp_path, kind):
        photo = str(tmp_path / "reused-name.jpg")
        Image.new("RGB", (80, 60), "red").save(photo)
        _analysis(photo)
        pid = _encode_id(photo)
        first_version = client.get(f"/api/photos/{pid}").json().get("image_version")
        assert first_version, "Photo responses must version their image URLs"
        url = f"/api/photos/{pid}/{kind}"
        first = client.get(url, params={"v": first_version})
        assert first.headers["cache-control"] == "max-age=31536000, immutable"
        old_stat = os.stat(photo)
        Image.new("RGB", (80, 60), "blue").save(photo)
        os.utime(photo, ns=(old_stat.st_atime_ns, old_stat.st_mtime_ns + 1_000_000))

        second_version = client.get(f"/api/photos/{pid}").json()["image_version"]
        assert second_version != first_version
        second = client.get(url, params={"v": second_version}, headers={"If-None-Match": first.headers["etag"]})
        assert second.status_code == 200
        with Image.open(io.BytesIO(second.content)) as image:
            r, _, b = image.getpixel((20, 20))
            assert b > 240 and r < 10
        stale_url = client.get(url, params={"v": first_version})
        assert "immutable" not in stale_url.headers["cache-control"]

    def test_reanalysis_replaces_existing_derivatives(self, tmp_path):
        photo = str(tmp_path / "same.jpg")
        cache = str(tmp_path / "cache")
        Image.new("RGB", (80, 60), "red").save(photo)
        analyze_photo(photo, thumbnail_dir=cache)
        Image.new("RGB", (80, 60), "blue").save(photo)
        analyze_photo(photo, thumbnail_dir=cache)
        for derivative in (thumbnail_cache_path(photo, cache), preview_cache_path(photo, cache)):
            with Image.open(derivative) as image:
                r, _, b = image.getpixel((20, 20))
                assert b > 240 and r < 10


class TestFolderParam:
    def test_detail_sharpness_uses_the_same_scale_as_quality_scoring(self):
        _analysis("/cards/test.jpg")  # raw Laplacian variance is 200, not 200%.
        state.analyses["/cards/test.jpg"]["focus_uncertain"] = True
        detail = client.get(f"/api/photos/{_encode_id('/cards/test.jpg')}").json()
        assert detail["sharpness"] == 40.0
        assert detail["focus_uncertain"] is True

    def _seed_two_cards(self):
        state.input_folders = ["/cards/sd1", "/cards/sd2"]
        _analysis("/cards/sd1/a.jpg", score=90)
        _analysis("/cards/sd1/b.jpg", score=80)
        _analysis("/cards/sd2/c.jpg", score=70)

    def test_photo_entry_includes_folder(self):
        self._seed_two_cards()

        res = client.get("/api/photos", params={"category": "keep"})

        folders = {p["filename"]: p["folder"] for p in res.json()["photos"]}
        assert folders == {
            "a.jpg": "/cards/sd1",
            "b.jpg": "/cards/sd1",
            "c.jpg": "/cards/sd2",
        }

    def test_folder_filter_limits_results(self):
        self._seed_two_cards()

        res = client.get(
            "/api/photos", params={"category": "keep", "folder": "/cards/sd1"}
        )

        names = [p["filename"] for p in res.json()["photos"]]
        assert names == ["a.jpg", "b.jpg"]

    def test_folder_filter_does_not_match_sibling_prefix(self):
        state.input_folders = ["/cards/sd1", "/cards/sd10"]
        _analysis("/cards/sd1/a.jpg")
        _analysis("/cards/sd10/z.jpg")

        res = client.get("/api/photos", params={"folder": "/cards/sd1"})

        assert [p["filename"] for p in res.json()["photos"]] == ["a.jpg"]

    def test_folders_endpoint_returns_counts(self):
        self._seed_two_cards()

        res = client.get("/api/folders")

        by_path = {f["path"]: f for f in res.json()["folders"]}
        assert by_path["/cards/sd1"]["count"] == 2
        assert by_path["/cards/sd2"]["count"] == 1
        assert by_path["/cards/sd1"]["name"] == "sd1"


class TestSortParam:
    def _seed(self):
        _analysis("/p/bbb.jpg", score=90)
        _analysis("/p/aaa.jpg", score=50)
        _analysis("/p/ccc.jpg", score=70)

    def test_default_sort_is_score_descending(self):
        self._seed()

        res = client.get("/api/photos")

        assert [p["filename"] for p in res.json()["photos"]] == [
            "bbb.jpg", "ccc.jpg", "aaa.jpg",
        ]

    def test_filename_sort_is_alphabetical(self):
        self._seed()

        res = client.get("/api/photos", params={"sort": "filename"})

        assert [p["filename"] for p in res.json()["photos"]] == [
            "aaa.jpg", "bbb.jpg", "ccc.jpg",
        ]

    def test_invalid_sort_rejected(self):
        self._seed()

        res = client.get("/api/photos", params={"sort": "banana"})

        assert res.status_code == 422
