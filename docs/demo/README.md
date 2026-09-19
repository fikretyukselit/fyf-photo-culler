# Demo assets

Captured from the actual React interface using the user-supplied, 373-photo FRC dataset. Scores and initial classifications come from the real Python engine. Playwright routes the demo's API calls to an isolated in-memory session; decisions and export do not modify the native application's session or copy source files. Displayed folder names are sanitized.

- `../screenshot-review.png`: clean contact sheet for the README.
- `workflow.gif`: captioned walkthrough, approximately 27 seconds, 1100 px wide.
- `01-import.jpg` through `07-complete.jpg`: seven tutorial chapters.
- `chapters.json`: captions and image references.
- `../tutorial.html`: standalone interactive guide with embedded images and no external requests. Starts paused; supports chapters, keyboard navigation and play/pause.

The walkthrough shortens analysis and export waits. It is not a speed benchmark. Source photographs and generated analysis/cache files are not checked in.

## Regenerate

Use a photo dataset you have permission to include in public documentation. From the repository root, with project dependencies and Playwright Chromium installed:

```bash
python3 scripts/audit_culling.py /path/to/photos /tmp/fyf-demo
```

Start the frontend separately with `bun run --cwd ui dev`. The capture expects Vite at `http://127.0.0.1:1420`; no running backend is required.

```bash
node ui/scripts/capture-demo.mjs /tmp/fyf-demo/dataset.json

ffmpeg -y -f concat -safe 0 -i /tmp/fyf-demo/frames/frames.txt \
  -vf 'fps=8,scale=1100:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle' \
  -loop 0 docs/demo/workflow.gif

node ui/scripts/build-tutorial.mjs
```

The GIF uses actual screenshots and chapter cuts, not generated interface imagery. Review the assets before publishing, including captions and photo content. If using another dataset, update the dataset-specific counts in the README, tutorial introduction and audit report.
