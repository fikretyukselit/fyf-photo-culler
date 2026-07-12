# Review UX & Performance Overhaul — Design

**Date:** 2026-07-12
**Goal:** Make the Review screen fast and keyboard-first so a media-team member with
several SD cards and thousands of photos can cull them quickly, and eliminate the
image-loading / scroll performance problems.

## Problems (diagnosed)

### Performance
1. **Lazy thumbnail generation.** `GET /api/photos/{id}/thumbnail` decodes the
   full-resolution JPEG on first request (PIL open + EXIF transpose + cv2 resize
   + imwrite). A first scroll through a fresh session fires hundreds of these.
   Meanwhile `analyze_photo()` already decodes every image to 1024px during
   analysis — the thumbnail can be written there at near-zero marginal cost.
2. **No HTTP cache headers.** Thumbnail/full endpoints send no `Cache-Control`
   or `ETag`, so the webview refetches every image each time a virtualized row
   remounts while scrolling.
3. **No medium-size preview.** The detail panel upsizes a 300px thumbnail
   (too blurry to judge sharpness — the whole point of culling) and the
   fullscreen/compare views load the full multi-MB original (slow).

### UX
4. **No keyboard-first triage.** K/M/R only act on a multi-selection. The core
   pro workflow — arrow to a photo, hit one key, auto-advance — doesn't exist.
5. **No loupe mode.** No large-image review loop with prev/next + K/M/R +
   zoom-to-100% (Photo Mechanic / Lightroom culling style).
6. **No source-folder filter.** Users load several SD cards but can't see or
   filter which card/folder a photo came from.
7. **Broken sort.** Client-side filename sort reorders only the pages loaded so
   far; the server always sorts by score.
8. **Slow-feeling actions.** Every keep/maybe/reject waits on two sequential
   round-trips (override + summary) before the UI updates.
9. **No shortcut discoverability, no grid density control.**

## Design

### Backend (FastAPI)
- **B1 — Thumbnails at analysis time.** `analyze_photo(path, thumbnail_dir=None)`
  gains an optional dir; when set, it writes the 320px thumbnail *and* a 1024px
  preview from the already-decoded image (`save_derivatives_from_image`), using
  the existing md5-of-path cache naming (`{key}.jpg`, `{key}.preview.jpg`).
  The pipeline passes `state.thumbnail_cache_dir`. On-demand generation stays as
  fallback (session restore, cache cleared).
- **B2 — Cache headers.** Thumbnail/preview/full responses get
  `Cache-Control: max-age=31536000, immutable` plus an ETag derived from the
  source file's `(mtime, size)`; return 304 on `If-None-Match`.
- **B3 — Preview endpoint.** `GET /api/photos/{id}/preview` serves the 1024px
  derivative (generated on demand if missing).
- **B4 — Folder awareness.** `GET /api/folders` returns the session's input
  folders with photo counts; `/api/photos` accepts `folder=` (path prefix match)
  and each photo entry gains a `folder` field (the input folder it belongs to).
- **B5 — Server-side sort.** `/api/photos` accepts `sort=score|filename`
  (default `score`); pagination follows the chosen order.

### Frontend (React)
- **F1 — Grid perf.** `decoding="async"` + fade-in on load for tiles; stable
  server order (no client re-sort); scroll-load effect gets proper deps; density
  toggle (S/M/L → 160/200/260px columns).
- **F2 — Keyboard triage.** K/M/R apply to the selection when one exists,
  otherwise to the focused photo; focus auto-advances after triage. Arrow keys
  move focus; Enter/Space opens loupe; Esc clears. All actions are optimistic:
  store + summary update immediately, server call in background, rollback+toast
  on error.
- **F3 — Loupe mode.** Fullscreen viewer over the filtered list: 1024px preview
  (full res swapped in for zoom), ←/→ navigate, K/M/R triage + auto-advance,
  Z or click toggles zoom, F loads full resolution, filmstrip strip at the
  bottom, destination badge + score always visible. Replaces the old
  detail-panel fullscreen overlay.
- **F4 — Detail panel.** Uses the 1024px preview; gains prev/next navigation
  and a position counter ("34 / 812").
- **F5 — Folder chips.** When >1 input folder, a chip row under the top bar
  filters by source folder (server-side).
- **F6 — Shortcut help.** `?` opens a shortcuts overlay; bottom bar shows a
  compact hint.
- **F7 — i18n.** All new strings in EN and TR.

### Out of scope
Visual redesign of Landing/Processing/Export, RAW support, XMP sidecars,
multi-window. GroupPanel/Compare only get the cheaper preview images and
benefit from cache headers.

## Error handling
- Optimistic updates roll back the store and re-fetch the summary if the API
  call fails; a small toast reports the failure.
- Preview endpoint falls back to generating from the original; 404s keep the
  existing behavior.

## Testing
- Backend: unit tests for derivative generation from an in-memory image, ETag/
  304 behavior, `folder` filter, `sort` param, `/api/folders`.
- Frontend: `tsc && vite build` gate (no test harness exists in ui/).
