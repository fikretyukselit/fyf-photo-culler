"""Reject macOS releases with broken signatures or mismatched helper architectures."""
import argparse
import json
import os
import selectors
import signal
import tempfile
import time
import urllib.request
import plistlib
import subprocess
from pathlib import Path

ARCHITECTURES = {"aarch64-apple-darwin": "arm64", "x86_64-apple-darwin": "x86_64"}


def check(command, description):
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        raise ValueError(f"{description}:\n{result.stdout}{result.stderr}")


def verify(bundle: Path, target: str):
    contents = bundle / "Contents"
    info = plistlib.loads((contents / "Info.plist").read_bytes())
    executable = info.get("CFBundleExecutable", "")
    if not executable or Path(executable).name != executable:
        raise ValueError("Missing or invalid CFBundleExecutable")
    binaries = [contents / "MacOS" / executable, contents / "MacOS/fyf-backend"]
    for binary in binaries:
        if not binary.is_file():
            raise ValueError(f"Missing required executable: {binary}")
        check(["lipo", str(binary), "-verify_arch", ARCHITECTURES[target]],
              f"Wrong architecture for {binary.name}; expected {ARCHITECTURES[target]}")
    # A linker-only executable signature is not a sealed, signed app bundle.
    if not (contents / "_CodeSignature/CodeResources").is_file():
        raise ValueError("Incomplete app signature: sealed resources are missing")
    for binary in binaries:
        check(["codesign", "--verify", "--strict", "--verbose=2", str(binary)],
              f"Invalid executable signature: {binary.name}")
    check(["codesign", "--verify", "--deep", "--strict", "--verbose=2", str(bundle)],
          "Invalid app bundle signature")
    print(f"Verified signed {ARCHITECTURES[target]} app and backend: {bundle}")


def smoke_backend(bundle: Path):
    """Catch hardened-runtime/Python loading failures before publishing."""
    binary = (bundle / "Contents/MacOS/fyf-backend").resolve()
    with tempfile.TemporaryDirectory(prefix="fyf-release-smoke-") as directory:
        with open(Path(directory) / "stderr.log", "w+") as errors:
            child = subprocess.Popen(
                [str(binary)], cwd=directory, env=dict(os.environ, FYF_DATA_DIR=directory),
                stdout=subprocess.PIPE, stderr=errors, text=True, start_new_session=True,
            )
            try:
                port = None
                deadline = time.monotonic() + 90
                with selectors.DefaultSelector() as selector:
                    selector.register(child.stdout, selectors.EVENT_READ)
                    while time.monotonic() < deadline:
                        if child.poll() is not None:
                            errors.seek(0)
                            raise ValueError(f"Packaged backend exited before startup: {errors.read()}")
                        if selector.select(timeout=1):
                            line = child.stdout.readline().strip()
                            if line.startswith("BACKEND_PORT="):
                                port = int(line.split("=", 1)[1])
                                break
                if not port:
                    raise ValueError("Packaged backend did not start within 90 seconds")
                # The port is announced immediately before the HTTP server starts.
                last_error = None
                deadline = time.monotonic() + 10
                while time.monotonic() < deadline:
                    try:
                        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/session", timeout=2) as response:
                            session = json.load(response)
                            if session.get("resumable") is not False:
                                raise ValueError("Backend smoke test did not use a fresh isolated session")
                            print("Packaged backend started and served HTTP 200 with isolated session data")
                            return
                    except OSError as error:
                        last_error = error
                        time.sleep(0.1)
                raise ValueError(f"Packaged backend HTTP check failed: {last_error}")
            finally:
                try:
                    os.killpg(child.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    child.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL)
                    child.wait()
                child.stdout.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--target", choices=ARCHITECTURES, required=True)
    parser.add_argument("--smoke-test", action="store_true", help="Start the signed backend with isolated data")
    args = parser.parse_args()
    try:
        verify(args.bundle, args.target)
        if args.smoke_test:
            smoke_backend(args.bundle)
    except (ValueError, OSError, plistlib.InvalidFileException) as error:
        parser.exit(1, f"macOS release validation failed: {error}\n")
