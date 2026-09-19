"""Release aliases preserve installers while keeping README URLs stable."""

import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "prepare_release_downloads.py"
INSTALLERS = {
    "FYF.Photo.Culler_0.2.1_aarch64.dmg": "FYF-Photo-Culler-macos-arm64.dmg",
    "FYF.Photo.Culler_0.2.1_x64.dmg": "FYF-Photo-Culler-macos-x64.dmg",
    "FYF.Photo.Culler_0.2.1_x64-setup.exe": "FYF-Photo-Culler-windows-x64-setup.exe",
    "FYF.Photo.Culler_0.2.1_amd64.deb": "FYF-Photo-Culler-linux-amd64.deb",
    "FYF.Photo.Culler-0.2.1-1.x86_64.rpm": "FYF-Photo-Culler-linux-x86_64.rpm",
    "FYF.Photo.Culler_0.2.1_amd64.AppImage": "FYF-Photo-Culler-linux-amd64.AppImage",
}


def seed(directory):
    directory.mkdir()
    for name in INSTALLERS:
        (directory / name).write_bytes(f"signed installer: {name}".encode())
    (directory / "FYF.Photo.Culler_0.2.1_amd64.AppImage.sig").write_text("signature")
    (directory / "FYF.Photo.Culler_x64.app.tar.gz").write_text("updater archive")


def run(source, output):
    return subprocess.run(
        [sys.executable, str(SCRIPT), str(source), str(output)],
        capture_output=True, text=True,
    )


def test_copies_all_platforms_without_changing_original_or_updater_files(tmp_path):
    source, output = tmp_path / "artifacts", tmp_path / "downloads"
    seed(source)
    before = {p.name: p.read_bytes() for p in source.iterdir()}
    result = run(source, output)
    assert result.returncode == 0, result.stderr
    assert sorted(p.name for p in output.iterdir()) == sorted(INSTALLERS.values())
    for original, alias in INSTALLERS.items():
        assert (output / alias).read_bytes() == before[original]
    assert {p.name: p.read_bytes() for p in source.iterdir()} == before


def test_missing_platform_fails_before_creating_partial_downloads(tmp_path):
    source, output = tmp_path / "artifacts", tmp_path / "downloads"
    seed(source)
    (source / "FYF.Photo.Culler_0.2.1_x64.dmg").unlink()
    result = run(source, output)
    assert result.returncode != 0
    assert "macos-x64" in result.stderr
    assert not output.exists()


def test_ambiguous_architecture_fails_instead_of_choosing_wrong_installer(tmp_path):
    source, output = tmp_path / "artifacts", tmp_path / "downloads"
    seed(source)
    (source / "FYF.Photo.Culler_0.2.2_x64-setup.exe").write_bytes(b"different release")
    result = run(source, output)
    assert result.returncode != 0
    assert "windows-x64" in result.stderr
    assert not output.exists()


def test_nested_build_artifacts_and_next_version_keep_the_same_aliases(tmp_path):
    source, output = tmp_path / "artifacts", tmp_path / "downloads"
    seed(source)
    nested = source / "bundle" / "installers"
    nested.mkdir(parents=True)
    for original in INSTALLERS:
        # Tauri's local names have spaces; GitHub replaces them with dots.
        name = original.replace("0.2.1", "0.3.0").replace("FYF.Photo.Culler", "FYF Photo Culler")
        (source / original).rename(nested / name)
    result = run(source, output)
    assert result.returncode == 0, result.stderr
    assert sorted(p.name for p in output.iterdir()) == sorted(INSTALLERS.values())
