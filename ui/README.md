# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

### Workspace interaction tests

Run `bun install`, then `bunx playwright install chromium` once and `bun run test:e2e`.
The suite starts Vite and uses deterministic API fixtures; it does not read or modify
real photo folders. It covers import, session resume, keyboard decisions, undo,
preview failures, export summaries, modal focus, Turkish and responsive themes.
Screenshots and failure traces are written to the ignored `test-results/` directory.
Native Tauri file dialogs and OS folder reveal still need a desktop smoke test.

The design rationale is in [`../docs/ux-design.md`](../docs/ux-design.md).
