import json
import logging
import os
from typing import Dict, List

from tqdm import tqdm

from culling.utils import safe_copy

logger = logging.getLogger(__name__)

DEST_TO_DIR = {
    "keep": "keep",
    "maybe": "maybe",
    "blurry": os.path.join("reject", "blurry"),
    "dark": os.path.join("reject", "dark"),
    "overexposed": os.path.join("reject", "overexposed"),
    "duplicate": os.path.join("reject", "duplicate"),
    "similar": os.path.join("reject", "similar"),
}


def organize_photos(paths: List[str], analyses: Dict[str, dict],
                    destinations: Dict[str, str], output_dir: str,
                    dry_run: bool = False, progress_callback=None) -> None:
    if dry_run:
        logger.info("Dry run — skipping file copies")
        return

    for i, path in enumerate(tqdm(paths, desc="Copying files", disable=progress_callback is not None)):
        dest_key = destinations.get(path)
        if dest_key is None:
            logger.warning(f"No destination for {path}, skipping")
            continue
        sub_dir = DEST_TO_DIR.get(dest_key, "reject")
        safe_copy(path, os.path.join(output_dir, sub_dir))
        if progress_callback:
            progress_callback("copying", i + 1, len(paths))


def generate_report(paths: List[str], analyses: Dict[str, dict],
                    destinations: Dict[str, str], skipped: List[str]) -> dict:
    photos = []
    for path in paths:
        info = analyses.get(path, {})
        photos.append({
            "file": os.path.basename(path),
            "path": path,
            "quality_score": info.get("quality_score"),
            "tier": info.get("tier"),
            "destination": destinations.get(path, "unknown"),
            "reject_reason": info.get("reject_reason"),
            "sharpness": info.get("sharpness_raw"),
            "exposure": info.get("exposure"),
            "contrast": info.get("contrast"),
            "exif_score": info.get("exif_score"),
            "iso": info.get("iso"),
            "shutter_speed": info.get("shutter_speed"),
        })

    dest_counts = {}
    for d in destinations.values():
        dest_counts[d] = dest_counts.get(d, 0) + 1

    summary = {
        "total": len(paths),
        "keep": dest_counts.get("keep", 0),
        "maybe": dest_counts.get("maybe", 0),
        "reject_blurry": dest_counts.get("blurry", 0),
        "reject_dark": dest_counts.get("dark", 0),
        "reject_overexposed": dest_counts.get("overexposed", 0),
        "reject_duplicate": dest_counts.get("duplicate", 0),
        "reject_similar": dest_counts.get("similar", 0),
        "skipped": len(skipped),
    }

    return {"summary": summary, "photos": photos, "skipped": skipped}


def save_report(report: dict, output_dir: str) -> str:
    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, "report.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    logger.info(f"Report saved to {path}")
    return path
