"""Read-only JPEG audit; generated data goes outside the source directory."""

import argparse
import json
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from culling.duplicates import detect_duplicates_and_similar
from culling.technical import analyze_photo


def progress(stage, current, total):
    if current == total:
        print(f"{stage}: {current}/{total}", flush=True)


def destination(analysis, rejection):
    """Match backend/routes/analysis.py's category assignment."""
    if analysis["auto_reject"]:
        return analysis["reject_reason"]
    if rejection:
        return rejection
    if analysis["tier"] == "good":
        return "keep"
    if analysis["tier"] == "marginal":
        return "maybe"
    return analysis.get("reject_reason") or "blurry"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    root, out = args.dataset.resolve(), args.output.resolve()
    if not root.is_dir():
        parser.error("dataset must be a directory")
    if out == root or root in out.parents:
        parser.error("output must be outside the source dataset")
    files = sorted(
        str(p) for p in root.rglob("*")
        if p.is_file() and p.suffix.lower() in (".jpg", ".jpeg")
    )
    if not files:
        parser.error("no JPEG files found")
    out.mkdir(parents=True, exist_ok=True)
    cache = out / "cache"
    started = time.monotonic()
    analyses = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {
            pool.submit(analyze_photo, p, thumbnail_dir=str(cache)): p
            for p in files
        }
        for index, future in enumerate(as_completed(futures), 1):
            value = future.result()
            if value:
                analyses[futures[future]] = value
            if index % 50 == 0:
                print(f"Analyzed {index}/{len(files)}", flush=True)

    # Stabilize candidate ordering for reproducible capture. The engine's
    # equal-score/equal-size best-pick tie remains an independent limitation.
    analyses = dict(sorted(analyses.items()))
    candidates = [p for p, a in analyses.items() if not a["auto_reject"]]
    _, rejected, groups = detect_duplicates_and_similar(
        candidates, analyses, progress_callback=progress
    )
    destinations = {
        p: destination(a, rejected.get(p)) for p, a in analyses.items()
    }
    spans = []
    for group in groups:
        timestamps = [
            analyses[p]["datetime_original"] for p in group["members"]
            if analyses[p]["datetime_original"] is not None
        ]
        if len(timestamps) > 1:
            spans.append({
                "id": group["id"],
                "count": len(group["members"]),
                "span": round(max(timestamps) - min(timestamps), 3),
                "members": [Path(p).name for p in group["members"]],
            })
    result = {
        "analyses": analyses,
        "destinations": destinations,
        "groups": groups,
        "counts": dict(Counter(destinations.values())),
        "elapsed": round(time.monotonic() - started, 2),
        "total": len(files),
        "analyzed": len(analyses),
        "group_spans": sorted(spans, key=lambda x: x["span"], reverse=True),
        "missing_timestamps": sum(
            a["datetime_original"] is None for a in analyses.values()
        ),
    }
    (out / "dataset.json").write_text(json.dumps(result, indent=2))
    private_keys = {"analyses", "destinations", "groups", "group_spans"}
    print(json.dumps({k: v for k, v in result.items() if k not in private_keys}, indent=2))
    print("Longest groups:", json.dumps(result["group_spans"][:5]))


if __name__ == "__main__":
    main()
