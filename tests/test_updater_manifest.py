"""The manifest must reference the exact filenames published to GitHub."""
import json
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/generate_updater_manifest.py"
ASSETS = {
    "darwin-aarch64": "FYF Photo Culler_aarch64.app.tar.gz",
    "darwin-x86_64": "FYF Photo Culler_x64.app.tar.gz",
    "windows-x86_64": "FYF Photo Culler_0.2.2_x64-setup.exe",
    "linux-x86_64": "FYF Photo Culler_0.2.2_amd64.AppImage",
}


def seed(root):
    root.mkdir()
    for platform, name in ASSETS.items():
        (root / name).write_bytes(platform.encode())
        (root / (name + ".sig")).write_text('signature "' + platform + '"\n')


def run(root, output):
    return subprocess.run([sys.executable, str(SCRIPT), str(root), str(output),
                           "--tag", "v0.2.2", "--repository", "owner/repo"],
                          capture_output=True, text=True)


def test_urls_match_published_names_and_signatures_match_architecture(tmp_path):
    root, output = tmp_path / "artifacts", tmp_path / "latest.json"
    seed(root)
    result = run(root, output)
    assert result.returncode == 0, result.stderr
    manifest = json.loads(output.read_text())
    assert manifest["version"] == "0.2.2"
    for platform, entry in manifest["platforms"].items():
        name = unquote(entry["url"].rsplit("/", 1)[1])
        assert " " not in name
        assert entry["url"].startswith("https://github.com/owner/repo/releases/download/v0.2.2/")
        assert (root / name).read_bytes() == platform.encode()
        assert (root / (name + ".sig")).read_text().strip() == entry["signature"]


def test_missing_signature_fails_without_publishing_or_renaming(tmp_path):
    root, output = tmp_path / "artifacts", tmp_path / "latest.json"
    seed(root)
    (root / (ASSETS["darwin-aarch64"] + ".sig")).unlink()
    before = sorted(p.name for p in root.iterdir())
    assert run(root, output).returncode != 0
    assert not output.exists()
    assert sorted(p.name for p in root.iterdir()) == before


def test_ambiguous_platform_fails(tmp_path):
    root, output = tmp_path / "artifacts", tmp_path / "latest.json"
    seed(root)
    (root / "Other_aarch64.app.tar.gz").write_bytes(b"other")
    assert run(root, output).returncode != 0
    assert not output.exists()


def test_normalized_name_collision_fails_before_changing_files(tmp_path):
    root, output = tmp_path / "artifacts", tmp_path / "latest.json"
    seed(root)
    (root / "some file.dmg").write_bytes(b"one")
    (root / "some.file.dmg").write_bytes(b"two")
    result = run(root, output)
    assert result.returncode != 0
    assert "collision" in result.stderr.lower()
    assert not output.exists()
    assert (root / "some file.dmg").read_bytes() == b"one"
