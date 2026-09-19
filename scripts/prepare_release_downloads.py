"""Copy installers to stable asset names for GitHub /releases/latest/download URLs.

Versioned installers, updater archives, signatures and latest.json are preserved.
Validate every platform before writing anything, so incomplete builds cannot
silently publish a partly broken README download table.
"""

import argparse
import shutil
from pathlib import Path

DOWNLOADS = {
    "FYF-Photo-Culler-macos-arm64.dmg": "*_aarch64.dmg",
    "FYF-Photo-Culler-macos-x64.dmg": "*_x64.dmg",
    "FYF-Photo-Culler-windows-x64-setup.exe": "*_x64-setup.exe",
    "FYF-Photo-Culler-linux-amd64.deb": "*_amd64.deb",
    "FYF-Photo-Culler-linux-x86_64.rpm": "*.x86_64.rpm",
    "FYF-Photo-Culler-linux-amd64.AppImage": "*_amd64.AppImage",
}


def prepare_downloads(source: Path, output: Path) -> None:
    source, output = source.resolve(), output.resolve()
    if not source.is_dir():
        raise ValueError(f"Artifact directory does not exist: {source}")
    if output == source or source in output.parents:
        raise ValueError("Output must be outside the artifact directory")
    selected = {}
    for alias, pattern in DOWNLOADS.items():
        matches = sorted(p for p in source.rglob(pattern) if p.is_file())
        if len(matches) != 1:
            raise ValueError(f"{alias}: expected one {pattern} installer, found {len(matches)}")
        if matches[0].stat().st_size == 0:
            raise ValueError(f"{alias}: installer is empty")
        selected[alias] = matches[0]

    output.mkdir(parents=True, exist_ok=True)
    for alias, original in selected.items():
        shutil.copy2(original, output / alias)
        print(f"{original.name} -> {alias}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    try:
        prepare_downloads(args.source, args.output)
    except (ValueError, OSError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
