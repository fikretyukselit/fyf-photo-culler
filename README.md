<p align="center">
  <img src="ui/src/assets/orta.png" alt="FYF Logo" width="100" />
</p>

<h1 align="center">FYF Photo Culler</h1>

<p align="center">
  <strong>AI-powered photo culling and organization for FRC competition photography</strong>
</p>

<p align="center">
  <a href="#download">Download</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#screenshot">Screenshot</a> &middot;
  <a href="#getting-started">Getting Started</a> &middot;
  <a href="#tech-stack">Tech Stack</a> &middot;
  <a href="#contributing">Contributing</a> &middot;
  <a href="#license">License</a>
</p>

<p align="center">
  <a href="https://github.com/fikretyukselit/fyf-photo-culler/releases/latest"><img src="https://img.shields.io/github/v/release/fikretyukselit/fyf-photo-culler?color=orange&label=latest" alt="Latest Release" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/language-TR%20%7C%20EN-green" alt="Language" />
  <img src="https://img.shields.io/github/license/fikretyukselit/fyf-photo-culler" alt="License" />
  <a href="https://github.com/fikretyukselit/fyf-photo-culler/releases"><img src="https://img.shields.io/github/downloads/fikretyukselit/fyf-photo-culler/total?color=brightgreen" alt="Downloads" /></a>
</p>

---

An open-source desktop application built by volunteers of **[Fikret Yuksel Foundation](https://fikretyukselfoundation.org)**. Designed to help FRC (FIRST Robotics Competition) media teams quickly sort through hundreds of competition photos — keeping the best shots, detecting duplicates, and organizing everything automatically.

> **Load your SD cards → AI scores every shot → cull with <kbd>K</kbd> <kbd>M</kbd> <kbd>R</kbd> → export, organized.**
> A full competition day culled in minutes, not hours.

## Download

<table>
  <tr>
    <th>Platform</th>
    <th>File</th>
    <th>Notes</th>
  </tr>
  <tr>
    <td><strong>macOS (Apple Silicon)</strong></td>
    <td><a href="https://github.com/fikretyukselit/fyf-photo-culler/releases/latest/download/FYF.Photo.Culler_0.2.0_aarch64.dmg">📦 .dmg (ARM)</a></td>
    <td>M1, M2, M3, M4 Macs</td>
  </tr>
  <tr>
    <td><strong>macOS (Intel)</strong></td>
    <td><a href="https://github.com/fikretyukselit/fyf-photo-culler/releases/latest/download/FYF.Photo.Culler_0.2.0_x64.dmg">📦 .dmg (x64)</a></td>
    <td>Pre-2020 Intel Macs</td>
  </tr>
  <tr>
    <td><strong>Windows</strong></td>
    <td><a href="https://github.com/fikretyukselit/fyf-photo-culler/releases/latest/download/FYF.Photo.Culler_0.2.0_x64-setup.exe">📦 .exe Installer</a></td>
    <td>Windows 10/11 (64-bit)</td>
  </tr>
  <tr>
    <td><strong>Linux (Debian/Ubuntu)</strong></td>
    <td><a href="https://github.com/fikretyukselit/fyf-photo-culler/releases/latest/download/FYF.Photo.Culler_0.2.0_amd64.deb">📦 .deb</a></td>
    <td>Ubuntu, Debian, Pop!_OS</td>
  </tr>
  <tr>
    <td><strong>Linux (Fedora/RHEL)</strong></td>
    <td><a href="https://github.com/fikretyukselit/fyf-photo-culler/releases/latest/download/FYF.Photo.Culler-0.2.0-1.x86_64.rpm">📦 .rpm</a></td>
    <td>Fedora, RHEL, openSUSE</td>
  </tr>
  <tr>
    <td><strong>Linux (Universal)</strong></td>
    <td><a href="https://github.com/fikretyukselit/fyf-photo-culler/releases/latest/download/FYF.Photo.Culler_0.2.0_amd64.AppImage">📦 .AppImage</a></td>
    <td>All Linux distros</td>
  </tr>
</table>

> **Auto-update:** The app automatically checks for new versions. You'll get an in-app notification when an update is available.

## Screenshot

<p align="center">
  <img src="docs/screenshot-landing.png" alt="FYF Photo Culler — Landing Screen" width="680" />
</p>

## Features

### Analysis
- **Technical quality scoring** — sharpness, exposure, contrast and EXIF combine into a 0–100 score for every photo
- **Duplicate & burst detection** — perceptual hashing + SSIM catches exact duplicates; feature matching groups burst/similar shots and auto-picks the best frame
- **Smart categorization** — every photo lands in Keep / Maybe / Reject before you touch anything

### Review at speed
- **Keyboard-first culling** — arrow keys move focus, <kbd>K</kbd>/<kbd>M</kbd>/<kbd>R</kbd> decide and auto-advance to the next photo; no clicking required
- **Loupe view** — <kbd>Enter</kbd> opens a fullscreen preview with zoom to full resolution, a filmstrip, and the same one-key triage
- **Per-card filtering** — shooting with multiple cameras? One click isolates a single SD card
- **Compare mode** — 2–4 candidates side by side with synchronized zoom & pan
- **Undo / redo everywhere** — <kbd>⌘Z</kbd> reverses any decision, including batch moves
- **Instant grid** — thumbnails are generated during analysis and served with immutable caching, so scrolling thousands of photos stays smooth

### Workflow
- **Session resume** — close the app mid-cull; every decision is persisted and restored on the next launch
- **Multi-folder input** — several cards at once, merged or per-folder output
- **Organized export** — Keep / Maybe / Reject copied into tidy folders with live progress
- **First-launch tour** — a 20-second animated walkthrough of the whole flow
- **Dark & light mode, TR / EN** — glassmorphism UI with FYF brand colors
- **Cross-platform** — native desktop app for macOS (.dmg), Windows (.exe), and Linux (.deb / .AppImage)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- [Rust](https://rustup.rs) (latest stable)
- Python 3.9+

### Development Setup

```bash
# Clone the repo
git clone https://github.com/fikretyukselit/fyf-photo-culler.git
cd fyf-photo-culler

# Install Python dependencies
pip install fastapi "uvicorn[standard]" opencv-python-headless Pillow imagehash scikit-image tqdm numpy

# Start the Python backend (Terminal 1)
python3 -m backend.server

# Install frontend dependencies and start the app (Terminal 2)
cd ui
bun install
bun run tauri dev
```

The backend will print `BACKEND_PORT=9470` — the frontend connects to it automatically.

### Building for Production

```bash
# Build Python sidecar binary (uses fyf-backend.spec)
pip install pyinstaller
pyinstaller fyf-backend.spec --noconfirm

# Copy to Tauri binaries directory
cp dist/fyf-backend ui/src-tauri/binaries/fyf-backend-$(rustc -vV | grep host | awk '{print $2}')

# Build the app
cd ui && bun run tauri build
```

Output: `.dmg` (macOS), `.exe` installer (Windows), or `.deb` / `.AppImage` (Linux) in `ui/src-tauri/target/release/bundle/`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Shell** | [Tauri 2.0](https://tauri.app) |
| **Frontend** | React + TypeScript + Vite |
| **UI Components** | [shadcn/ui](https://ui.shadcn.com) + Tailwind CSS |
| **State Management** | Zustand |
| **Backend** | Python + FastAPI (localhost sidecar) |
| **Image Analysis** | OpenCV, Pillow, imagehash, scikit-image |
| **Package Manager** | Bun |

## Architecture

```
fyf-photo-culler/
├── backend/              # FastAPI server (Python sidecar)
│   ├── server.py         # App entry + port discovery
│   ├── state.py          # In-memory session state
│   ├── thumbnail.py      # Thumbnail & preview derivatives
│   └── routes/           # REST API endpoints
│       ├── analysis.py   # POST /analyze, GET /progress (SSE)
│       ├── photos.py     # Photo listing, filters, cached image serving
│       ├── review.py     # Manual override endpoints
│       └── export.py     # File export with progress
├── culling/              # Core analysis engine
│   ├── technical.py      # Quality scoring (sharpness, exposure, contrast)
│   ├── duplicates.py     # Duplicate & burst detection (pHash, SSIM, ORB)
│   ├── organizer.py      # File organization & reporting
│   └── utils.py          # Image loading, thumbnails, file utilities
├── ui/                   # Tauri + React desktop app
│   ├── src/
│   │   ├── components/   # React components (Landing, Review, Export...)
│   │   └── lib/          # API client, stores, i18n
│   └── src-tauri/        # Rust config + sidecar management
└── pyproject.toml        # Python project metadata
```

**Data flow:** Tauri launches Python sidecar → sidecar starts FastAPI on localhost → frontend calls REST API with SSE for real-time progress.

**Why it feels fast:** 320px thumbnails and 1024px previews are written during analysis from the already-decoded image (no on-demand full-resolution decodes), image responses ship with immutable HTTP caching (ETag/304), and every review decision applies optimistically — the UI never waits for the network.

## Keyboard Shortcuts (Review Screen)

| Key | Action |
|-----|--------|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Move focus across the grid |
| <kbd>K</kbd> / <kbd>M</kbd> / <kbd>R</kbd> | Keep / Maybe / Reject the focused photo (or the selection) — auto-advances |
| <kbd>Enter</kbd> | Open the loupe (large view) |
| <kbd>Z</kbd> | Zoom to full resolution in the loupe |
| <kbd>Space</kbd> | Select / deselect the focused photo |
| <kbd>A</kbd> | Select all in the current tab |
| <kbd>C</kbd> | Compare selected (2–4) |
| <kbd>⌘Z</kbd> / <kbd>⌘⇧Z</kbd> | Undo / Redo |
| <kbd>?</kbd> | Show the shortcuts overlay |
| <kbd>Esc</kbd> | Close panels / clear selection |

## Contributing

This is an open-source project by FYF volunteers. Contributions are welcome!

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## About Fikret Yuksel Foundation

[Fikret Yuksel Foundation](https://fikretyukselfoundation.org) is a non-profit organization dedicated to inspiring and educating young students, enabling them to discover and develop their potential while fostering Turkey's growth. This tool was built to support our FRC robotics teams' media operations.

<p align="center">
  <img src="ui/src/assets/orta.png" alt="FYF" width="48" />
  <br />
  <sub>Made with care by FYF volunteers</sub>
</p>
