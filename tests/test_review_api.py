"""API tests for override endpoints and category filtering."""

import base64
import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.server import app
from backend.state import state


client = TestClient(app)


def _encode_id(path: str) -> str:
    return base64.urlsafe_b64encode(path.encode()).decode()


def _seed_state(path: str, destination: str = "keep"):
    """Populate session state with a single analyzed photo."""
    state.analyses = {
        path: {
            "path": path,
            "quality_score": 75.0,
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
    }
    state.destinations = {path: destination}
    state.overrides = {}
    state.groups = {}
    state.path_to_group = {}


def _seed_many(specs):
    """Seed multiple photos. Each spec is a dict with keys path, destination,
    quality_score, tier, iso."""
    state.analyses = {}
    state.destinations = {}
    state.overrides = {}
    state.groups = {}
    state.path_to_group = {}
    for s in specs:
        path = s["path"]
        state.analyses[path] = {
            "path": path,
            "quality_score": s.get("quality_score", 50.0),
            "tier": s.get("tier", "good"),
            "sharpness_raw": 200.0,
            "exposure": 80.0,
            "contrast": 70.0,
            "exif_score": None,
            "iso": s.get("iso"),
            "shutter_speed": None,
            "aperture": None,
            "file_size": 1000,
        }
        state.destinations[path] = s["destination"]


def _ids(res):
    return [p["id"] for p in res.json()["photos"]]


@pytest.fixture(autouse=True)
def clean_state():
    """Reset shared session state before and after each test so overrides,
    analyses and groups from one test never leak into the next."""
    def _reset():
        state.analyses = {}
        state.destinations = {}
        state.overrides = {}
        state.groups = {}
        state.path_to_group = {}
        state.undo_stack = []
        state.redo_stack = []
        state.loaded_from_disk = False
        state.saved_at = None

    _reset()
    yield
    _reset()


class TestRejectOverride:
    def test_override_reject_returns_200(self):
        path = "/tmp/photo_a.jpg"
        _seed_state(path, destination="keep")
        pid = _encode_id(path)

        res = client.post("/api/override", json={"photo_id": pid, "destination": "reject"})
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    def test_rejected_photo_appears_in_reject_category(self):
        path = "/tmp/photo_b.jpg"
        _seed_state(path, destination="keep")
        pid = _encode_id(path)

        client.post("/api/override", json={"photo_id": pid, "destination": "reject"})

        res = client.get("/api/photos", params={"category": "reject"})
        assert res.status_code == 200
        ids = [p["id"] for p in res.json()["photos"]]
        assert pid in ids

        # And it should no longer show under keep.
        keep_res = client.get("/api/photos", params={"category": "keep"})
        keep_ids = [p["id"] for p in keep_res.json()["photos"]]
        assert pid not in keep_ids

    def test_batch_override_reject_returns_200(self):
        path = "/tmp/photo_c.jpg"
        _seed_state(path, destination="maybe")
        pid = _encode_id(path)

        res = client.post(
            "/api/override/batch",
            json={"photo_ids": [pid], "destination": "reject"},
        )
        assert res.status_code == 200
        assert res.json()["count"] == 1

        cat = client.get("/api/photos", params={"category": "reject"})
        assert pid in [p["id"] for p in cat.json()["photos"]]

    def test_invalid_destination_returns_400(self):
        path = "/tmp/photo_d.jpg"
        _seed_state(path, destination="keep")
        pid = _encode_id(path)

        res = client.post("/api/override", json={"photo_id": pid, "destination": "banana"})
        assert res.status_code == 400

        # Batch endpoint rejects it too.
        batch = client.post(
            "/api/override/batch",
            json={"photo_ids": [pid], "destination": "banana"},
        )
        assert batch.status_code == 400


class TestPhotoFilters:
    def test_score_range_filters(self):
        _seed_many([
            {"path": "/tmp/low.jpg", "destination": "keep", "quality_score": 20.0},
            {"path": "/tmp/mid.jpg", "destination": "keep", "quality_score": 55.0},
            {"path": "/tmp/high.jpg", "destination": "keep", "quality_score": 90.0},
        ])
        low, mid, high = _encode_id("/tmp/low.jpg"), _encode_id("/tmp/mid.jpg"), _encode_id("/tmp/high.jpg")

        res = client.get("/api/photos", params={"min_score": 50, "max_score": 80})
        ids = _ids(res)
        assert mid in ids
        assert low not in ids and high not in ids
        assert res.json()["total"] == 1

        # min only
        res = client.get("/api/photos", params={"min_score": 50})
        ids = _ids(res)
        assert set(ids) == {mid, high}

    def test_iso_range_filters(self):
        _seed_many([
            {"path": "/tmp/iso100.jpg", "destination": "keep", "iso": 100},
            {"path": "/tmp/iso3200.jpg", "destination": "keep", "iso": 3200},
            {"path": "/tmp/isonone.jpg", "destination": "keep", "iso": None},
        ])
        iso100, iso3200, isonone = (
            _encode_id("/tmp/iso100.jpg"),
            _encode_id("/tmp/iso3200.jpg"),
            _encode_id("/tmp/isonone.jpg"),
        )

        res = client.get("/api/photos", params={"max_iso": 800})
        ids = _ids(res)
        assert iso100 in ids
        # High ISO and missing-ISO photos are excluded when the filter is active.
        assert iso3200 not in ids
        assert isonone not in ids

    def test_reject_reason_filter(self):
        _seed_many([
            {"path": "/tmp/dup.jpg", "destination": "duplicate", "tier": "good"},
            {"path": "/tmp/blur.jpg", "destination": "blurry", "tier": "unacceptable"},
        ])
        dup, blur = _encode_id("/tmp/dup.jpg"), _encode_id("/tmp/blur.jpg")

        res = client.get(
            "/api/photos",
            params={"category": "reject", "reject_reason": "duplicate"},
        )
        ids = _ids(res)
        assert ids == [dup]
        assert blur not in ids

    def test_mismatch_good_in_reject(self):
        # A high-quality photo that was rejected — engine disagrees.
        _seed_many([
            {"path": "/tmp/goodrej.jpg", "destination": "duplicate", "tier": "good"},
            {"path": "/tmp/goodkeep.jpg", "destination": "keep", "tier": "good"},
        ])
        goodrej, goodkeep = _encode_id("/tmp/goodrej.jpg"), _encode_id("/tmp/goodkeep.jpg")

        res = client.get("/api/photos", params={"mismatch": "true"})
        ids = _ids(res)
        assert goodrej in ids
        assert goodkeep not in ids

    def test_mismatch_unacceptable_in_keep(self):
        # A low-quality photo the user kept — engine disagrees.
        _seed_many([
            {"path": "/tmp/badkeep.jpg", "destination": "keep", "tier": "unacceptable"},
            {"path": "/tmp/badrej.jpg", "destination": "blurry", "tier": "unacceptable"},
        ])
        badkeep, badrej = _encode_id("/tmp/badkeep.jpg"), _encode_id("/tmp/badrej.jpg")

        res = client.get("/api/photos", params={"mismatch": "true"})
        ids = _ids(res)
        assert badkeep in ids
        assert badrej not in ids

    def test_mismatch_respects_overrides(self):
        # Engine tier good, destination keep → no mismatch. Override to reject
        # makes the effective destination reject → now a mismatch.
        _seed_many([
            {"path": "/tmp/ov.jpg", "destination": "keep", "tier": "good"},
        ])
        pid = _encode_id("/tmp/ov.jpg")

        res = client.get("/api/photos", params={"mismatch": "true"})
        assert pid not in _ids(res)

        client.post("/api/override", json={"photo_id": pid, "destination": "reject"})
        res = client.get("/api/photos", params={"mismatch": "true"})
        assert pid in _ids(res)


class TestUndoRedo:
    def test_undo_reverts_single_override(self):
        _seed_state("/tmp/u1.jpg", destination="keep")
        pid = _encode_id("/tmp/u1.jpg")

        client.post("/api/override", json={"photo_id": pid, "destination": "reject"})
        assert state.overrides["/tmp/u1.jpg"] == "reject"

        res = client.post("/api/undo")
        body = res.json()
        assert body["status"] == "ok"
        assert "/tmp/u1.jpg" not in state.overrides  # back to unset
        assert body["can_undo"] is False
        assert body["can_redo"] is True

    def test_redo_reapplies(self):
        _seed_state("/tmp/u2.jpg", destination="keep")
        pid = _encode_id("/tmp/u2.jpg")

        client.post("/api/override", json={"photo_id": pid, "destination": "maybe"})
        client.post("/api/undo")
        assert "/tmp/u2.jpg" not in state.overrides

        res = client.post("/api/redo")
        assert res.json()["status"] == "ok"
        assert state.overrides["/tmp/u2.jpg"] == "maybe"

    def test_undo_batch_is_single_step(self):
        _seed_many([
            {"path": "/tmp/b1.jpg", "destination": "keep"},
            {"path": "/tmp/b2.jpg", "destination": "keep"},
        ])
        ids = [_encode_id("/tmp/b1.jpg"), _encode_id("/tmp/b2.jpg")]

        client.post("/api/override/batch", json={"photo_ids": ids, "destination": "reject"})
        assert state.overrides["/tmp/b1.jpg"] == "reject"
        assert state.overrides["/tmp/b2.jpg"] == "reject"

        client.post("/api/undo")
        assert "/tmp/b1.jpg" not in state.overrides
        assert "/tmp/b2.jpg" not in state.overrides

    def test_new_override_clears_redo(self):
        _seed_state("/tmp/u3.jpg", destination="keep")
        pid = _encode_id("/tmp/u3.jpg")

        client.post("/api/override", json={"photo_id": pid, "destination": "reject"})
        client.post("/api/undo")
        assert client.get("/api/history").json()["can_redo"] is True

        client.post("/api/override", json={"photo_id": pid, "destination": "maybe"})
        assert client.get("/api/history").json()["can_redo"] is False

    def test_undo_on_empty_history_is_noop(self):
        _seed_state("/tmp/u4.jpg", destination="keep")
        res = client.post("/api/undo")
        assert res.json()["status"] == "noop"


class TestSession:
    def test_session_not_resumable_by_default(self):
        _seed_state("/tmp/s1.jpg", destination="keep")
        # loaded_from_disk is False (reset by fixture) → not resumable.
        res = client.get("/api/session")
        assert res.json()["resumable"] is False

    def test_session_resumable_when_loaded_from_disk(self):
        _seed_state("/tmp/s2.jpg", destination="keep")
        state.loaded_from_disk = True
        res = client.get("/api/session")
        body = res.json()
        assert body["resumable"] is True
        assert body["summary"]["keep"] == 1

    def test_discard_clears_state(self):
        _seed_state("/tmp/s3.jpg", destination="keep")
        state.loaded_from_disk = True
        res = client.post("/api/session/discard")
        assert res.json()["status"] == "ok"
        assert state.analyses == {}
        assert client.get("/api/session").json()["resumable"] is False
