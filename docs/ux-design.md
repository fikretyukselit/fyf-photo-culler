# Photo culling workspace

The primary user is an FRC media volunteer reviewing multiple camera cards after an event. The job is to make confident keep/maybe/reject decisions quickly without losing originals or session work.

## Direction

Use a neutral contact-sheet workspace with restrained FYF gold. Photos carry the color; controls stay quiet. Avoid decorative gradients and floating glass panels. Local Inter Variable stays bundled for offline use, with compact tool labels and a larger, tightly spaced import heading.

Tokens: canvas #17191c, surface #202327, raised #292d32, text #eef0f2, muted #a5abb4, action #e9b85b. Light mode uses #f5f6f8, #ffffff, #e8ebef, #20242a, #59616d and #8b610f. Green, amber and red encode decisions alongside labels and icons.

Import layout: explanatory left column / folder preparation panel on the right, collapsing to a single column. Persistent top workflow indicator connects Import → Analyze → Review → Export. Review uses separate context and tools rows above the contact sheet; an optional inspector occupies the right edge. Export makes the actual category counts and copy behavior explicit.

## Interaction priorities

- Start with a usable import screen, not an automatically playing tour.
- Keep existing native folder dialogs; browser development also accepts local folder paths.
- Explain JPEG support before analysis; show skipped-file information inline.
- Prevent accidental replacement of an existing session through contextual confirmation.
- Preserve keyboard culling, undo, compare, virtualization and multi-card filtering.
- Provide actionable request errors, retry and clear-filter states.
- Use full-frame thumbnails: cropping can hide critical framing defects.
- Make focus, selection, category and score distinct; never rely only on color.
- Handle light theme, narrow windows, reduced motion and keyboard focus explicitly.

## Scope

The analysis engine and its scoring criteria remain intact. No invented AI capabilities, cloud upload or model integration. This is a local, offline-first desktop editing workflow.

## Verification

- Production TypeScript/Vite build passed.
- Python regression suite: 84 tests passed, including current-session resume and export destination metadata.
- Playwright: 9 interaction scenarios passed using deterministic API fixtures. Coverage includes import with skipped files, all-photo review, keyboard triage and auto-advance, undo, preview/error recovery, export counts, dialog focus, compare selection, and responsive TR/EN themes.
- Turkish/light/dark layout checks passed again after the final translation cleanup.
- Browser tests do not exercise native OS dialogs or the packaged sidecar. The README screenshot is the actual Turkish import screen captured by Playwright.
