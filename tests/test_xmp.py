"""Tests for culling.xmp sidecar writing."""

import os
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from culling.xmp import build_xmp, write_sidecar


def _touch(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(b"x")


class TestWriteSidecar:
    def test_keep_photo_creates_xmp_with_rating_5_and_green(self, tmp_path):
        image_path = str(tmp_path / "DSC_1.JPG")
        _touch(image_path)

        sidecar_path = write_sidecar(image_path, "keep")

        assert sidecar_path == str(tmp_path / "DSC_1.xmp")
        content = open(sidecar_path, encoding="utf-8").read()
        assert 'xmp:Rating="5"' in content
        assert 'xmp:Label="Green"' in content

    def test_maybe_photo_creates_xmp_with_rating_3_and_yellow(self, tmp_path):
        image_path = str(tmp_path / "DSC_2.JPG")
        _touch(image_path)

        sidecar_path = write_sidecar(image_path, "maybe")

        content = open(sidecar_path, encoding="utf-8").read()
        assert 'xmp:Rating="3"' in content
        assert 'xmp:Label="Yellow"' in content

    def test_reject_subtypes_create_xmp_with_rating_1_and_red(self, tmp_path):
        for i, dest in enumerate(
            ["reject", "blurry", "dark", "overexposed", "duplicate", "similar"]
        ):
            image_path = str(tmp_path / f"DSC_{i}.JPG")
            _touch(image_path)

            sidecar_path = write_sidecar(image_path, dest)

            content = open(sidecar_path, encoding="utf-8").read()
            assert 'xmp:Rating="1"' in content
            assert 'xmp:Label="Red"' in content

    def test_sidecar_path_swaps_extension_not_appends(self, tmp_path):
        image_path = str(tmp_path / "DSC_3.JPG")
        _touch(image_path)

        sidecar_path = write_sidecar(image_path, "keep")

        assert sidecar_path == str(tmp_path / "DSC_3.xmp")
        assert sidecar_path != image_path + ".xmp"

    def test_unmapped_destination_returns_none(self, tmp_path):
        image_path = str(tmp_path / "DSC_4.JPG")
        _touch(image_path)

        assert write_sidecar(image_path, "unknown") is None

    def test_overwrites_existing_sidecar(self, tmp_path):
        image_path = str(tmp_path / "DSC_5.JPG")
        _touch(image_path)
        sidecar_path = str(tmp_path / "DSC_5.xmp")
        with open(sidecar_path, "w") as f:
            f.write("old content")

        write_sidecar(image_path, "maybe")

        content = open(sidecar_path, encoding="utf-8").read()
        assert "old content" not in content
        assert 'xmp:Rating="3"' in content


class TestBuildXmp:
    def test_output_is_well_formed_xml(self):
        content = build_xmp(5, "Green")
        # Strip the XMP packet wrapper comments (?xpacket ...?) which are
        # processing instructions, not part of the XML document proper.
        xml_only = content.split("?>", 1)[1].rsplit("<?xpacket", 1)[0]
        root = ET.fromstring(xml_only)
        assert root is not None

    def test_contains_rating_and_label(self):
        content = build_xmp(3, "Yellow")
        assert 'xmp:Rating="3"' in content
        assert 'xmp:Label="Yellow"' in content
