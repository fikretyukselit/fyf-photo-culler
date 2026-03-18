import logging
from typing import Dict, List, Set, Tuple

import cv2
import numpy as np
import imagehash
from PIL import Image
from skimage.metrics import structural_similarity as ssim
from tqdm import tqdm

from culling.utils import load_and_resize

logger = logging.getLogger(__name__)


def compute_phash(path: str) -> imagehash.ImageHash:
    img = Image.open(path)
    return imagehash.phash(img)


def find_pairs(hashes: Dict[str, imagehash.ImageHash],
               threshold: int) -> List[Tuple[str, str, int]]:
    """Find pairs within hamming distance threshold. Returns (p1, p2, distance)."""
    paths = list(hashes.keys())
    pairs = []
    for i in range(len(paths)):
        for j in range(i + 1, len(paths)):
            dist = hashes[paths[i]] - hashes[paths[j]]
            if dist <= threshold:
                pairs.append((paths[i], paths[j], dist))
    return pairs


def verify_ssim(candidates: List[Tuple[str, str, int]],
                threshold: float, progress_callback=None) -> List[Tuple[str, str]]:
    """Verify candidate pairs using SSIM."""
    verified = []
    for i, (p1, p2, _) in enumerate(tqdm(candidates, desc="SSIM verification",
                                          disable=progress_callback is not None or len(candidates) < 5)):
        img1 = load_and_resize(p1, max_edge=512)
        img2 = load_and_resize(p2, max_edge=512)
        if img1 is None or img2 is None:
            continue
        h = min(img1.shape[0], img2.shape[0])
        w = min(img1.shape[1], img2.shape[1])
        img1 = cv2.resize(img1, (w, h))
        img2 = cv2.resize(img2, (w, h))
        gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
        score = ssim(gray1, gray2)
        if score > threshold:
            verified.append((p1, p2))
        if progress_callback:
            progress_callback("ssim_verification", i + 1, len(candidates))
    return verified


def verify_feature_match(candidates: List[Tuple[str, str, int]],
                         min_match_ratio: float = 0.25,
                         progress_callback=None) -> List[Tuple[str, str]]:
    """Verify candidate pairs using ORB feature matching.
    More robust to small camera shifts than SSIM."""
    orb = cv2.ORB_create(nfeatures=1000)
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    verified = []

    for i, (p1, p2, _) in enumerate(tqdm(candidates, desc="Feature matching",
                                          disable=progress_callback is not None or len(candidates) < 5)):
        img1 = load_and_resize(p1, max_edge=512)
        img2 = load_and_resize(p2, max_edge=512)
        if img1 is None or img2 is None:
            continue
        gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)

        kp1, des1 = orb.detectAndCompute(gray1, None)
        kp2, des2 = orb.detectAndCompute(gray2, None)

        if des1 is None or des2 is None or len(kp1) < 10 or len(kp2) < 10:
            continue

        matches = bf.match(des1, des2)
        good = [m for m in matches if m.distance < 50]
        ratio = len(good) / min(len(kp1), len(kp2))

        if ratio > min_match_ratio:
            verified.append((p1, p2))

        if progress_callback:
            progress_callback("feature_matching", i + 1, len(candidates))

    return verified


def _build_groups(pairs: List[Tuple[str, str]], all_paths: List[str]) -> List[Set[str]]:
    parent = {p: p for p in all_paths}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for a, b in pairs:
        union(a, b)

    groups = {}
    for p in all_paths:
        root = find(p)
        if root not in groups:
            groups[root] = set()
        groups[root].add(p)

    return [g for g in groups.values() if len(g) > 1]


def select_best_from_group(group: list, analyses: Dict[str, dict]) -> str:
    return max(group, key=lambda p: (analyses[p]["quality_score"], analyses[p]["file_size"]))


def detect_duplicates_and_similar(
    paths: List[str], analyses: Dict[str, dict],
    progress_callback=None
) -> Tuple[Set[str], Dict[str, str]]:
    """Two-pass detection:
      1. Exact duplicates: pHash ≤ 5, SSIM > 0.95 → reject/duplicate
      2. Burst/similar:    pHash ≤ 15, SSIM > 0.75 → reject/similar (best kept)
    Returns (keep_set, reject_dict mapping path -> 'duplicate' or 'similar')
    """
    logger.info("Computing perceptual hashes...")
    hashes = {}
    for i, p in enumerate(tqdm(paths, desc="Hashing", disable=progress_callback is not None)):
        try:
            hashes[p] = compute_phash(p)
        except Exception as e:
            logger.warning(f"Could not hash {p}: {e}")
        if progress_callback:
            progress_callback("hashing", i + 1, len(paths))

    reject = {}

    # Pass 1: Exact duplicates
    logger.info("Pass 1: Finding exact duplicates (pHash ≤ 5, SSIM > 0.95)...")
    exact_candidates = find_pairs(hashes, threshold=5)
    logger.info(f"  {len(exact_candidates)} candidate pairs")
    if exact_candidates:
        exact_verified = verify_ssim(exact_candidates, threshold=0.95,
                                     progress_callback=progress_callback)
        logger.info(f"  {len(exact_verified)} confirmed duplicates")
        if exact_verified:
            groups = _build_groups(exact_verified, list(hashes.keys()))
            for group in groups:
                best = select_best_from_group(list(group), analyses)
                for p in group:
                    if p != best:
                        reject[p] = "duplicate"

    # Pass 2: Burst/similar (same photographer, same moment, slight shift)
    remaining = [p for p in paths if p not in reject]
    remaining_hashes = {p: hashes[p] for p in remaining if p in hashes}

    logger.info("Pass 2: Finding burst/similar shots (pHash ≤ 20, feature match)...")
    similar_candidates = find_pairs(remaining_hashes, threshold=20)
    logger.info(f"  {len(similar_candidates)} candidate pairs")
    if similar_candidates:
        similar_verified = verify_feature_match(similar_candidates, min_match_ratio=0.25,
                                                progress_callback=progress_callback)
        logger.info(f"  {len(similar_verified)} confirmed similar pairs")
        if similar_verified:
            groups = _build_groups(similar_verified, remaining)
            for group in groups:
                best = select_best_from_group(list(group), analyses)
                for p in group:
                    if p != best:
                        reject[p] = "similar"

    keep = set(paths) - set(reject.keys())
    logger.info(f"Result: {len(keep)} keep, {sum(1 for v in reject.values() if v == 'duplicate')} duplicates, {sum(1 for v in reject.values() if v == 'similar')} similar")
    return keep, reject
