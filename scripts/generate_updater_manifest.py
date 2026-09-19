#!/usr/bin/env python3
"""Normalize upload names and generate a manifest from validated signed artifacts."""
import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

PLATFORMS = {
    "darwin-aarch64": "*_aarch64.app.tar.gz",
    "darwin-x86_64": "*_x64.app.tar.gz",
    "windows-x86_64": "*-setup.exe",
    "linux-x86_64": "*.AppImage",
}


def generate(source: Path, output: Path, tag: str, repository: str):
    if not re.fullmatch(r"v\d+\.\d+\.\d+(?:-[\w.-]+)?", tag):
        raise ValueError(f"Invalid release tag: {tag}")
    if not re.fullmatch(r"[\w.-]+/[\w.-]+", repository):
        raise ValueError("Invalid repository")
    files = sorted(p for p in source.rglob("*") if p.is_file())
    # GitHub replaces spaces in uploaded names with dots. Rename before upload so
    # URLs use actual filenames, not names that GitHub will silently change.
    renamed = {p: p.with_name(p.name.replace(" ", ".")) for p in files}
    names = [p.name for p in renamed.values()]
    if len(names) != len(set(names)):
        raise ValueError("Release asset name collision after normalization")
    platforms = {}
    base = f"https://github.com/{repository}/releases/download/{quote(tag, safe='')}"
    for platform, pattern in PLATFORMS.items():
        matches = [p for p in files if p.match(pattern)]
        if len(matches) != 1 or matches[0].stat().st_size == 0:
            raise ValueError(f"Expected one nonempty updater artifact for {platform}")
        artifact = matches[0]
        sig = Path(str(artifact) + ".sig")
        if not sig.is_file() or not sig.read_text().strip():
            raise ValueError(f"Missing signature for {platform}: {artifact.name}")
        platforms[platform] = {
            "url": f"{base}/{quote(renamed[artifact].name, safe='')}",
            "signature": sig.read_text().strip(),
        }
    # Validate every platform and collision before changing any artifact.
    for original, normalized in renamed.items():
        if original != normalized:
            original.rename(normalized)
    manifest = {
        "version": tag.removeprefix("v"),
        "notes": f"FYF Photo Culler {tag}",
        "pub_date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "platforms": platforms,
    }
    output.write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--repository", required=True)
    args = parser.parse_args()
    try:
        generate(args.source, args.output, args.tag, args.repository)
    except (ValueError, OSError) as exc:
        parser.exit(1, f"Cannot generate updater manifest: {exc}\n")
