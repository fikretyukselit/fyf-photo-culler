# Contributing to FYF Photo Culler

FYF Photo Culler is maintained by volunteers of the [Fikret Yuksel Foundation](https://fikretyukselfoundation.org) and used by FIRST Robotics Competition (FRC) media teams. Contributions from other FIRST teams, event volunteers and photographers are welcome, whether or not you write code.

## Ways to help

- **Report what went wrong at a real event.** A photo the scorer got badly wrong, a duplicate group that merged two different matches, a crash on a specific camera's files. Open an [issue](https://github.com/fikretyukselit/fyf-photo-culler/issues) with the app version, platform and, if you can share it, a few sample photos.
- **Share test photos.** The scoring is tuned on a limited set of FRC events. Arena lighting, camera bodies and shooting styles differ; sample sets from other events make the defaults better for everyone. See [docs/algorithm-review.md](docs/algorithm-review.md) for how we evaluate changes.
- **Translate.** The interface ships in English and Turkish. Strings live under `ui/src/` and the usage notice under `docs/usage-notice.*.md`.
- **Improve the docs.** If a step in the README confused you, it will confuse the next team too.
- **Code.** Python analysis in `culling/` and `backend/`, the desktop app in `ui/`.

Questions and ideas belong in [Discussions](https://github.com/fikretyukselit/fyf-photo-culler/discussions). Use issues for confirmed bugs and concrete feature requests.

## Development setup

Prerequisites: Python 3.11, [Bun](https://bun.sh), and the [Tauri 2 system requirements](https://v2.tauri.app/start/prerequisites/) for your platform.

```bash
git clone https://github.com/fikretyukselit/fyf-photo-culler.git
cd fyf-photo-culler

# Backend (terminal 1)
pip install fastapi "uvicorn[standard]" opencv-python-headless Pillow imagehash scikit-image tqdm numpy
python3 -m backend.server

# Desktop app (terminal 2)
cd ui
bun install
bun run tauri dev
```

## Tests and checks

The same commands run in CI on every pull request.

```bash
# Backend
pip install pytest ruff httpx
ruff check --select F backend culling tests
python -m pytest tests/

# Frontend
cd ui
bunx tsc --noEmit
bun run build
```

Tests isolate session persistence through `FYF_DATA_DIR`, so they never touch your real app data. The macOS bundle tests in `tests/test_macos_bundle.py` need `codesign` and are skipped on other platforms.

## Pull requests

1. Fork the repository and create a branch from `main` (`fix/…`, `feat/…` or `docs/…`).
2. Keep a pull request to one change. Add or update tests for behavior changes.
3. Run the checks above before pushing.
4. Describe what the change does and how you verified it. Screenshots help for UI changes.
5. Maintainers squash-merge once CI is green.

Do not bump version numbers in a contribution; maintainers do that at release time following [docs/releasing.md](docs/releasing.md).

## Scope

The app runs entirely on the user's computer and never uploads photos. Contributions that add cloud services, telemetry or accounts will not be merged. Keep the culling engine deterministic and explainable; see the algorithm review document before changing scoring.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
