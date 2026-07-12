"""Tests for export output-dir resolution and the export SSE payload."""

import json
import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.server import app
from backend.state import state, resolve_output_dir


client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_state():
    def _reset():
        state.analyses = {}
        state.destinations = {}
        state.overrides = {}
        state.groups = {}
        state.path_to_group = {}
        state.input_folders = []
        state.merge_mode = True
        state.output_dir = "./output"

    _reset()
    yield
    _reset()


class TestResolveOutputDir:
    def test_empty_falls_back_to_pictures(self):
        resolved = resolve_output_dir("")
        assert os.path.isabs(resolved)
        assert resolved == os.path.join(
            os.path.expanduser("~"), "Pictures", "FYF Photo Culler"
        )

    def test_whitespace_falls_back(self):
        assert resolve_output_dir("   ") == resolve_output_dir("")

    def test_relative_becomes_absolute(self):
        assert os.path.isabs(resolve_output_dir("./output"))

    def test_home_is_expanded(self):
        resolved = resolve_output_dir("~/exports")
        assert resolved == os.path.join(os.path.expanduser("~"), "exports")

    def test_absolute_passes_through(self):
        assert resolve_output_dir("/tmp/out") == "/tmp/out"


class TestExportStream:
    def _seed_photo(self, tmp_path):
        photo = str(tmp_path / "src" / "a.jpg")
        os.makedirs(os.path.dirname(photo), exist_ok=True)
        with open(photo, "wb") as f:
            f.write(b"\xff\xd8\xff\xe0fake")
        state.analyses = {photo: {"path": photo}}
        state.destinations = {photo: "keep"}
        state.input_folders = [str(tmp_path / "src")]
        return photo

    def _events(self, body: str):
        return [
            json.loads(line[len("data: "):])
            for line in body.splitlines()
            if line.startswith("data: ")
        ]

    def test_complete_event_reports_absolute_output_dir(self, tmp_path):
        self._seed_photo(tmp_path)
        out = str(tmp_path / "out")
        state.output_dir = out

        res = client.get("/api/export")
        events = self._events(res.text)

        done = events[-1]
        assert done["stage"] == "complete"
        assert done["output_dir"] == out
        assert os.path.isfile(os.path.join(out, "keep", "a.jpg"))

    def test_empty_output_dir_resolves_to_default(self, tmp_path, monkeypatch):
        home = tmp_path / "home"
        home.mkdir()
        monkeypatch.setenv("HOME", str(home))
        self._seed_photo(tmp_path)
        state.output_dir = ""

        res = client.get("/api/export")
        done = self._events(res.text)[-1]

        expected = os.path.join(str(home), "Pictures", "FYF Photo Culler")
        assert done["output_dir"] == expected
        assert os.path.isfile(os.path.join(expected, "keep", "a.jpg"))
