import logging
from functools import lru_cache

import numpy as np
from typing import Dict, List, Optional, Set, Tuple

import cv2
import imagehash
from PIL import Image, ImageOps
from skimage.metrics import structural_similarity as ssim
from tqdm import tqdm

from culling.utils import load_and_resize

logger = logging.getLogger(__name__)

# Photos captured more than this many seconds apart cannot belong to the same
# burst. Used to prune candidate pairs before the expensive hash comparison.
BURST_TIME_WINDOW = 2.0


def compute_phash(path: str) -> imagehash.ImageHash:
    # exif_transpose so a portrait shot and its rotated variant hash the same —
    # matches the orientation handling in utils.load_and_resize.
    with Image.open(path) as img:
        img = ImageOps.exif_transpose(img)
        return imagehash.phash(img)


class _HashIndex:
    """BK-tree over Hamming distance; equal hashes share a bucket."""

    def __init__(self):
        self.root = None

    def add(self, value: int, path: str) -> None:
        if self.root is None:
            self.root = (value, [path], {})
            return
        node = self.root
        while True:
            distance = bin(value ^ node[0]).count("1")
            if distance == 0:
                node[1].append(path)
                return
            child = node[2].get(distance)
            if child is None:
                node[2][distance] = (value, [path], {})
                return
            node = child

    def query(self, value: int, threshold: int):
        pending = [self.root] if self.root is not None else []
        while pending:
            node = pending.pop()
            distance = bin(value ^ node[0]).count("1")
            if distance <= threshold:
                for path in node[1]:
                    yield path, distance
            lower, upper = distance - threshold, distance + threshold
            pending.extend(child for edge, child in node[2].items() if lower <= edge <= upper)


def find_pairs(hashes: Dict[str, imagehash.ImageHash],
               threshold: int,
               timestamps: Optional[Dict[str, Optional[float]]] = None,
               time_window: Optional[float] = None) -> List[Tuple[str, str, int]]:
    """Find all qualifying pairs, without scanning every known-time pair.

    Timestamped bursts use a sorted sliding window. Missing-time photos are
    queried against a Hamming index, as are global duplicate candidates.
    The index is exact (no approximate-neighbor misses); dense hash neighborhoods
    can still have quadratic output. Pair and traversal order are deterministic.
    """
    if threshold < 0:
        return []
    if time_window is not None and time_window < 0:
        raise ValueError("time_window must be nonnegative")
    values = {p: int(str(h), 16) for p, h in hashes.items()}
    pairs = []
    index = _HashIndex()
    if timestamps is None or time_window is None:
        for path in sorted(values):
            for other, distance in index.query(values[path], threshold):
                pairs.append((other, path, distance))
            index.add(values[path], path)
        return pairs

    known, missing = [], []
    for path in sorted(values):
        timestamp = timestamps.get(path)
        if timestamp is None:
            missing.append(path)
        else:
            known.append((timestamp, path))
    known.sort()
    left = 0
    for right, (timestamp, path) in enumerate(known):
        while left < right and timestamp - known[left][0] > time_window:
            left += 1
        for position in range(left, right):
            other = known[position][1]
            distance = bin(values[path] ^ values[other]).count("1")
            if distance <= threshold:
                pairs.append((other, path, distance))

    # No timestamp means no temporal pruning, but still no all-pairs scan.
    if missing:
        for _, path in known:
            index.add(values[path], path)
        for path in missing:
            for other, distance in index.query(values[path], threshold):
                pairs.append((other, path, distance))
            index.add(values[path], path)
    return pairs


def _regional_match(img1: np.ndarray, img2: np.ndarray, threshold: float,
                    valid: Optional[np.ndarray] = None) -> bool:
    """Require local structure AND color agreement, not just a shared backdrop.

    This is intentionally conservative: different action should survive review.
    It does not claim to recognize faces or robots.
    """
    if img1.shape != img2.shape or min(img1.shape[:2]) < 16:
        return False
    gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
    _, similarity = ssim(gray1, gray2, data_range=255, full=True)
    if valid is None:
        valid = np.ones(gray1.shape, dtype=np.uint8)
    if np.mean(valid > 0) < 0.9:
        return False
    # SSIM uses a 7px neighborhood; don't include warped/cropped boundaries.
    mask = cv2.erode(valid.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
    if not np.any(mask) or float(similarity[mask].mean()) <= threshold:
        return False
    color_error = np.abs(img1.astype(np.float32) - img2.astype(np.float32)).mean(axis=2)
    h, w = gray1.shape
    for row in range(4):
        for col in range(4):
            region = np.s_[row * h // 4:(row + 1) * h // 4, col * w // 4:(col + 1) * w // 4]
            local_mask = mask[region]
            if np.mean(local_mask) < 0.5:
                return False
            if float(similarity[region][local_mask].mean()) < 0.90:
                return False
            if float(color_error[region][local_mask].mean()) > 12.0:
                return False
    return True


def verify_ssim(candidates: List[Tuple[str, str, int]],
                threshold: float, progress_callback=None,
                image_loader=None) -> List[Tuple[str, str]]:
    """Verify near-duplicates using global and regional structure/color."""
    load = image_loader or lru_cache(maxsize=32)(lambda p: load_and_resize(p, max_edge=512))
    verified = []
    for i, (p1, p2, _) in enumerate(tqdm(candidates, desc="SSIM verification",
                                          disable=progress_callback is not None or len(candidates) < 5)):
        try:
            img1, img2 = load(p1), load(p2)
            if img1 is None or img2 is None:
                continue
            # Don't distort different aspect ratios to force a duplicate match.
            if abs(img1.shape[1] / img1.shape[0] - img2.shape[1] / img2.shape[0]) > 0.01:
                continue
            h, w = min(img1.shape[0], img2.shape[0]), min(img1.shape[1], img2.shape[1])
            a, b = cv2.resize(img1, (w, h)), cv2.resize(img2, (w, h))
            if _regional_match(a, b, threshold):
                verified.append((p1, p2))
        finally:
            if progress_callback:
                progress_callback("ssim_verification", i + 1, len(candidates))
    return verified


def verify_feature_match(candidates: List[Tuple[str, str, int]],
                         min_match_ratio: float = 0.25,
                         progress_callback=None, image_loader=None) -> List[Tuple[str, str]]:
    """Require a consistent camera transform plus regional visual agreement."""
    orb = cv2.ORB_create(nfeatures=1000)
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    load = image_loader or lru_cache(maxsize=32)(lambda p: load_and_resize(p, max_edge=512))

    @lru_cache(maxsize=32)
    def features(path):
        img = load(path)
        if img is None:
            return None, (), None
        keypoints, descriptors = orb.detectAndCompute(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), None)
        return img, keypoints, descriptors

    verified = []
    for i, (p1, p2, _) in enumerate(tqdm(candidates, desc="Feature matching",
                                          disable=progress_callback is not None or len(candidates) < 5)):
        try:
            img1, kp1, des1 = features(p1)
            img2, kp2, des2 = features(p2)
            if des1 is None or des2 is None or min(len(kp1), len(kp2)) < 10:
                continue
            good = [m for m in bf.match(des1, des2) if m.distance < 50]
            if len(good) < 10 or len(good) / min(len(kp1), len(kp2)) <= min_match_ratio:
                continue
            src = np.float32([kp1[m.queryIdx].pt for m in good])
            dst = np.float32([kp2[m.trainIdx].pt for m in good])
            transform, inliers = cv2.estimateAffinePartial2D(
                src, dst, method=cv2.RANSAC, ransacReprojThreshold=3.0,
            )
            if transform is None or inliers is None or np.mean(inliers) < 0.6:
                continue
            scale = float(np.hypot(transform[0, 0], transform[1, 0]))
            if not 0.85 <= scale <= 1.15:
                continue
            h, w = img2.shape[:2]
            aligned = cv2.warpAffine(img1, transform, (w, h))
            valid = cv2.warpAffine(np.ones(img1.shape[:2], np.uint8), transform, (w, h), flags=cv2.INTER_NEAREST)
            if _regional_match(aligned, img2, threshold=0.92, valid=valid):
                verified.append((p1, p2))
        finally:
            if progress_callback:
                progress_callback("feature_matching", i + 1, len(candidates))
    return verified


def _quality_key(path: str, analyses: Dict[str, dict]) -> tuple:
    analysis = analyses.get(path, {})
    return (analysis.get("quality_score", 0), analysis.get("file_size", 0), path)


def select_best_from_group(group: list, analyses: Dict[str, dict]) -> str:
    return max(group, key=lambda p: _quality_key(p, analyses))


def _select_groups(exact_pairs, similar_pairs, paths, analyses, time_window):
    """Partition verified edges around deterministic, retained representatives.

    Every rejection has a directly verified edge to its group's best. Burst
    members also share a bounded capture-time span. Actual duplicate edges are
    independent of capture time (e.g. copied/re-exported files on other cards).
    """
    neighbors = {p: {} for p in paths}
    for kind, pairs in (("similar", similar_pairs), ("duplicate", exact_pairs)):
        for a, b in pairs:
            neighbors[a][b] = kind
            neighbors[b][a] = kind
    assigned, reject, groups = set(), {}, []
    for best in sorted(paths, key=lambda p: _quality_key(p, analyses), reverse=True):
        if best in assigned:
            continue
        assigned.add(best)
        members = [best]
        timestamp = analyses[best].get("datetime_original")
        times = [timestamp] if timestamp is not None else []
        for member in sorted(neighbors[best], key=lambda p: _quality_key(p, analyses), reverse=True):
            if member in assigned:
                continue
            kind = neighbors[best][member]
            timestamp = analyses[member].get("datetime_original")
            if kind == "similar" and timestamp is not None:
                proposed = times + [timestamp]
                if time_window is not None and max(proposed) - min(proposed) > time_window:
                    continue
                times = proposed
            assigned.add(member)
            members.append(member)
            reject[member] = kind
        if len(members) > 1:
            groups.append({
                "kind": "duplicate" if any(reject.get(p) == "duplicate" for p in members) else "similar",
                "members": members,
                "best": best,
            })
    groups.sort(key=lambda group: min(group["members"]))
    for index, group in enumerate(groups, 1):
        group["id"] = f"g{index:04d}"
    return reject, groups


def detect_duplicates_and_similar(
    paths: List[str], analyses: Dict[str, dict],
    progress_callback=None,
    time_window: Optional[float] = BURST_TIME_WINDOW,
) -> Tuple[Set[str], Dict[str, str], List[dict]]:
    """Global near-duplicate search, then time-bounded burst verification.

    pHash candidates are verified with local structure/color agreement; burst
    matches additionally require geometric alignment. Only direct matches to a
    retained representative are rejected. No transitive similarity rejection.
    """
    paths = sorted(set(paths))
    logger.info("Computing perceptual hashes...")
    hashes = {}
    for i, path in enumerate(tqdm(paths, desc="Hashing", disable=progress_callback is not None)):
        try:
            hashes[path] = compute_phash(path)
        except Exception as e:
            logger.warning(f"Could not hash {path}: {e}")
        if progress_callback:
            progress_callback("hashing", i + 1, len(paths))

    # Bounded and scoped to this run: reused across both verification passes.
    load = lru_cache(maxsize=32)(lambda p: load_and_resize(p, max_edge=512))
    timestamps = {p: analyses[p].get("datetime_original") for p in paths}
    exact_candidates = find_pairs(hashes, threshold=5)
    logger.info(f"Pass 1: {len(exact_candidates)} global duplicate candidate pairs")
    exact_verified = verify_ssim(
        exact_candidates, threshold=0.95, progress_callback=progress_callback, image_loader=load,
    )
    exact_edges = {frozenset(pair) for pair in exact_verified}
    similar_candidates = [
        (a, b, distance)
        for a, b, distance in find_pairs(hashes, threshold=20, timestamps=timestamps, time_window=time_window)
        if frozenset((a, b)) not in exact_edges
    ]
    logger.info(f"Pass 2: {len(similar_candidates)} burst candidate pairs")
    similar_verified = verify_feature_match(
        similar_candidates, progress_callback=progress_callback, image_loader=load,
    )
    reject, groups = _select_groups(exact_verified, similar_verified, paths, analyses, time_window)
    keep = set(paths) - set(reject)
    logger.info(f"Result: {len(keep)} keep, {sum(v == 'duplicate' for v in reject.values())} duplicates, {sum(v == 'similar' for v in reject.values())} similar")
    return keep, reject, groups
