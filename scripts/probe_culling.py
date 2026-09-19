"""Reproduce known failure modes with synthetic images in a fresh temporary directory."""

import json
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from culling.duplicates import _build_groups, compute_phash, verify_feature_match
from culling.technical import analyze_photo
from culling.utils import generate_thumbnail


def main():
    out = Path(tempfile.mkdtemp(prefix="fyf-algorithm-probes-"))
    rng = np.random.default_rng(7)
    img = np.full((480, 640, 3), 100, np.uint8)
    # Shared textured background; different central subjects.
    for _ in range(180):
        x, y = rng.integers(0, 640), rng.integers(0, 480)
        cv2.circle(
            img, (int(x), int(y)), int(rng.integers(3, 12)),
            tuple(int(c) for c in rng.integers(30, 230, 3)), -1,
        )
    a, b = img.copy(), img.copy()
    cv2.rectangle(a, (210, 130), (430, 350), (20, 20, 220), -1)
    cv2.rectangle(b, (210, 130), (430, 350), (220, 180, 20), -1)
    for image, label in [(a, "MOMENT A"), (b, "MOMENT B")]:
        cv2.putText(
            image, label, (225, 245), cv2.FONT_HERSHEY_SIMPLEX,
            .7, (255, 255, 255), 2,
        )
    pa, pb = str(out / "a.jpg"), str(out / "b.jpg")
    cv2.imwrite(pa, a)
    cv2.imwrite(pb, b)
    report = {
        "shared_background_different_subjects": {
            "hash_distance": int(compute_phash(pa) - compute_phash(pb)),
            "orb_groups": bool(verify_feature_match([(pa, pb, 0)])),
        },
        "transitive_group": sorted(next(iter(_build_groups(
            [("a", "b"), ("b", "c")], ["a", "b", "c"]
        )))),
    }
    # One sharp corner, eight textureless tiles.
    single = np.full((300, 450, 3), 128, np.uint8)
    stripes = np.where(np.indices((100, 150))[0] % 4 < 2, 255, 0)
    single[:100, :150] = np.repeat(stripes[:, :, None], 3, axis=2)
    ps = str(out / "one-tile.jpg")
    cv2.imwrite(ps, single)
    report["single_sharp_tile"] = analyze_photo(ps)

    # Same path, changed source pixels: does the derivative get refreshed?
    pc = str(out / "replace.jpg")
    pixels = []
    for color in ("red", "blue"):
        Image.new("RGB", (80, 60), color).save(pc)
        cache = generate_thumbnail(pc, str(out / "cache"))
        with Image.open(cache) as thumbnail:
            pixels.append(thumbnail.getpixel((20, 20)))
    report["stale_preview"] = {
        "before": pixels[0], "after_source_replaced": pixels[1]
    }
    payload = json.dumps(report, indent=2)
    print(payload)
    (out / "results.json").write_text(payload)
    print(f"Probe artifacts: {out}")


if __name__ == "__main__":
    main()
