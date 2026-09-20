"""Exercise the distribution gate against real macOS signatures, not mocked output."""
import plistlib
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/verify_macos_bundle.py"
pytestmark = pytest.mark.skipif(sys.platform != "darwin", reason="Requires macOS codesign and lipo")


@pytest.fixture
def app(tmp_path):
    root = tmp_path / "Test App.app"
    binaries = root / "Contents/MacOS"
    binaries.mkdir(parents=True)
    (root / "Contents/Resources").mkdir()
    (root / "Contents/Resources/message.txt").write_text("original")
    (root / "Contents/Info.plist").write_bytes(plistlib.dumps({
        "CFBundleExecutable": "ui", "CFBundleIdentifier": "com.fyf.signing-test",
        "CFBundlePackageType": "APPL", "CFBundleVersion": "1",
    }))
    source = tmp_path / "main.c"
    source.write_text("int main(void) { return 0; }\n")
    subprocess.run(["clang", str(source), "-o", str(binaries / "ui")], check=True)
    shutil.copy2(binaries / "ui", binaries / "fyf-backend")
    return root


def sign(app):
    for path in [app / "Contents/MacOS/fyf-backend", app]:
        subprocess.run(["codesign", "--force", "--sign", "-", str(path)], check=True, capture_output=True)


def verify(app, arch=None, smoke=False):
    arch = arch or subprocess.check_output(["uname", "-m"], text=True).strip()
    target = "aarch64-apple-darwin" if arch == "arm64" else "x86_64-apple-darwin"
    return subprocess.run([sys.executable, str(SCRIPT), str(app), "--target", target] + (["--smoke-test"] if smoke else []),
                          capture_output=True, text=True)


def test_linker_only_signature_is_rejected(app):
    result = verify(app)
    assert result.returncode != 0
    assert "signature" in result.stderr.lower()


def test_fully_sealed_bundle_is_accepted(app):
    sign(app)
    result = verify(app)
    assert result.returncode == 0, result.stderr


def test_modified_resource_is_rejected(app):
    sign(app)
    (app / "Contents/Resources/message.txt").write_text("modified")
    result = verify(app)
    assert result.returncode != 0
    assert "signature" in result.stderr.lower()


def test_wrong_architecture_is_rejected_even_with_a_valid_signature(app):
    sign(app)
    native = subprocess.check_output(["uname", "-m"], text=True).strip()
    result = verify(app, "x86_64" if native == "arm64" else "arm64")
    assert result.returncode != 0
    assert "architecture" in result.stderr.lower()


def test_bundle_without_backend_is_rejected(app):
    (app / "Contents/MacOS/fyf-backend").unlink()
    subprocess.run(
        ["codesign", "--force", "--sign", "-", str(app)], check=True, capture_output=True)
    result = verify(app)
    assert result.returncode != 0
    assert "fyf-backend" in result.stderr


def test_smoke_test_rejects_signed_backend_that_exits_before_serving(app):
    sign(app)
    result = verify(app, smoke=True)
    assert result.returncode != 0
    assert "exited before startup" in result.stderr
