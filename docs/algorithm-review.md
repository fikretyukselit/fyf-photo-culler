# Culling engine audit

Reviewed 20 September 2026. This audit does not change scoring or rejection rules.

## Evidence from the supplied dataset

The `fyf-photo-output-restored` dataset contains 373 JPEGs. A separate, read-only run analyzed all 373; all had capture timestamps. Derivatives and results were written outside the source folder, without changing the running application's session.

| Engine decision | Count |
|---|---:|
| Keep | 279 |
| Maybe | 15 |
| Reject: blurry | 20 |
| Reject: similar | 59 |
| Reject: duplicate / overexposed | 0 |

Elapsed wall time was 90.56 seconds on the local development machine, using four analysis workers and then duplicate detection. This is one run, not a controlled performance benchmark. The walkthrough changes one Keep to Maybe, so its export correctly shows 278 / 16 / 79.

These counts are **not accuracy measurements**. There are no human reference labels in this dataset. In particular, this audit does not establish that the 20 blurry or 59 similar decisions are correct or incorrect.

## Findings, in recommended order

### 1. A sharp background can dominate the quality score

**Reproduced with a synthetic image.** `compute_sharpness` averages the two largest Laplacian variances in a 3×3 grid. Averaging does not require both regions to be sharp: one extreme value can dominate. A striped corner with eight uniform tiles received a raw sharpness of 31,844.17 and a quality score of **91.18 / 100**, classified as `good` without automatic rejection.

This contradicts the function's claim that it requires two distinct sharp regions. It also explains a plausible FRC failure mode: a detailed scoreboard or arena marking can outweigh a soft robot or face. The synthetic example demonstrates the scoring weakness; it is not a measured false-keep rate for real photographs.

**Next change:** calibrate against labeled sharp/soft subjects, then use robust regional evidence and subject regions where available. Merely lowering the weight or changing a global threshold will not make the method subject-aware.

Source: [`compute_sharpness`, `compute_quality_score`](../culling/technical.py).

### 2. Shared backgrounds can group different subjects or actions

**Reproduced with a synthetic pair.** Two images shared a textured background but had differently colored and labeled central subjects. Their pHash distance was **12** (inside the similar threshold of 20), and ORB accepted the pair. With compatible timestamps, this pair qualifies for similarity grouping.

ORB uses the fraction of low-distance matches across the image. There is no subject comparison or geometric consistency check. A stationary arena can supply enough matching background features while the meaningful action changes. The group then keeps one frame and assigns the others to `similar` automatically.

**Next change:** distinguish grouping for review from confidence sufficient to reject. Add geometric verification and subject-region evidence; geometry alone will still accept a shared static background. Evaluate action changes, occlusion, expressions and robot positions using human labels.

Source: [`verify_feature_match`, `detect_duplicates_and_similar`](../culling/duplicates.py).

### 3. Pairwise similarity becomes an unrestricted chain

**Reproduced in the real dataset and a minimal graph.** If A matches B and B matches C, union-find puts all three together even when A and C were never verified. The two-second window limits pairs, not complete groups.

Three real groups exceeded that window:

| Members | Group span |
|---|---:|
| 316A3167–316A3170 | 3.69 seconds |
| 316A3338–316A3341 | 2.68 seconds |
| 316A3420–316A3423 | 2.47 seconds |

Longer groups are not automatically wrong. The issue is that membership does not guarantee similarity to the chosen best frame, yet all other members are rejected as similar.

**Next change:** verify each automatically rejected member against its selected representative and enforce an explicit group time policy. Ambiguous chains can remain review groups without forced rejection.

Source: [`_build_groups`, `select_best_from_group`](../culling/duplicates.py).

### 4. Reusing a file path can show the old photograph

**Reproduced with replacement image content.** Generate a thumbnail for a red JPEG, replace that JPEG with a blue one at the same path, and request a thumbnail again: the returned pixel remains red, `(254, 0, 0)`.

Cache filenames depend only on the source path. Existing derivatives are reused without checking source content or modification time. The same problem applies to previews and analysis-time derivative generation. Reused camera-card names or overwritten exports can therefore display stale content even after reanalysis.

**Next change:** version derivatives using source identity (at least size plus nanosecond modification time), use atomic derivative writes, and include the version in image URLs / HTTP caching. Test thumbnail, preview and full-image consistency after replacement.

Source: [`_cache_key`, `save_derivatives_from_image`, `_generate_derivative`](../culling/utils.py), [image responses](../backend/routes/photos.py).

### 5. Candidate enumeration still scales quadratically

**Established from code, not a large-dataset benchmark.** `find_pairs` enumerates every pair before applying timestamp pruning. At 10,000 photos, a single full pass visits 49,995,000 pairs. The time window saves comparisons, but not pair enumeration. SSIM and ORB also decode images again for candidate pairs.

**Next change:** sort timestamped photos and use a sliding time window; handle missing timestamps through a bounded hash index. Reuse resized images and descriptors with bounded memory. Preserve exact-duplicate search separately from burst timing: currently the two-second filter applies to both passes and can miss identical pixels with differing capture metadata.

Source: [`find_pairs`, `verify_ssim`, `verify_feature_match`](../culling/duplicates.py).

## Recommended validation before changing defaults

Build a human-labeled subset from this dataset covering moving robots, portraits, shallow depth of field, dark stands, near-duplicate action and genuine duplicates. Measure false rejection separately for blur and similarity; a single combined accuracy score hides the costly mistakes. Compare best-frame picks against human preferences and measure results across cameras and exposure settings.

Start with cache correctness and conservative grouping. Then calibrate quality scoring on labels. The current engine is a useful local computer-vision assistant, but its score is not a probability of photographic quality or a trained aesthetic judgment.

## Reproduce

With the project's Python dependencies installed, run from the repository root:

```bash
# Synthetic evidence, written to a fresh system temporary directory.
python3 scripts/probe_culling.py

# Read-only dataset run. Choose an output directory outside your source folder.
python3 scripts/audit_culling.py /path/to/photos /tmp/fyf-demo
```

The dataset audit writes local absolute paths to `dataset.json` for resolving images during capture. Keep that generated file and its cache local. Only the captured, sanitized demonstration assets belong in the repository.
