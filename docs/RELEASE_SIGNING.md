# Release Signing Runbook

Status: **not yet enabled**. Release builds currently ship unsigned (macOS) and
unsigned/uncertified (Windows). This doc records exactly what's needed to turn
signing on later, once the maintainer's Apple Developer account and a Windows
code-signing certificate are available. It is documentation only — no signing
identity has been wired into `tauri.conf.json` or the workflow, since a
placeholder/empty identity would break the currently-working unsigned build.

## macOS: Developer ID signing + notarization

### Why it matters
Without a Developer ID signature and Apple notarization, Gatekeeper blocks the
app on first launch ("app is damaged" / "unidentified developer"), and the
auto-updater's `.app.tar.gz` artifacts are more likely to be flagged by
scanners. Notarization also lets macOS show the normal "opened from the
internet, are you sure?" prompt instead of an outright block.

### GitHub secrets required
Add these as repository (or environment) secrets in GitHub Actions:

| Secret | What it is |
|---|---|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` export of the "Developer ID Application" certificate (`base64 -i cert.p12 \| pbcopy`) |
| `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | Exact identity string, e.g. `Developer ID Application: NAME (TEAMID)` — must match what's in the certificate |
| `APPLE_ID` | Apple ID email used for notarization submission |
| `APPLE_PASSWORD` | App-specific password for that Apple ID (generate at appleid.apple.com, not the account password) |
| `APPLE_TEAM_ID` | 10-character Apple Developer Team ID |

### Where they plug in
`tauri-action` (used in `.github/workflows/release.yml`) reads signing/
notarization config directly from environment variables — it does not require
editing `tauri.conf.json` for the certificate itself. When ready, add to the
`Build Tauri app` step's `env:` block for the macOS matrix entries:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
  APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
  APPLE_ID: ${{ secrets.APPLE_ID }}
  APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
  APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

`tauri-action` forwards `APPLE_SIGNING_IDENTITY` to `tauri-bundler`, which is
equivalent to setting `bundle.macOS.signingIdentity` in
`ui/src-tauri/tauri.conf.json`. You can instead set it directly in
`tauri.conf.json` (`"macOS": { "signingIdentity": "Developer ID Application: NAME (TEAMID)" }`),
but keeping it as a secret-driven env var avoids committing the identity
string and keeps the config portable for contributors who build unsigned
locally.

If the app uses any restricted entitlements (camera, hardened runtime
exceptions, etc.), add an `entitlements.plist` and reference it via
`bundle.macOS.entitlements` in `tauri.conf.json`. This app currently needs none
beyond the Tauri defaults.

Notarization itself is handled automatically by `tauri-action`/`tauri-bundler`
when `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` are present in the
environment — no separate `xcrun notarytool` step is required in the workflow.

### Verifying once enabled
- `codesign -dv --verbose=4 "FYF Photo Culler.app"` should show the Developer
  ID identity.
- `spctl -a -vv "FYF Photo Culler.app"` should report `accepted` /
  `source=Notarized Developer ID`.

## Windows: code signing

### Why it matters
An unsigned `.exe`/`.msi` triggers Microsoft SmartScreen ("Windows protected
your PC") on first run, and PyInstaller-built binaries (the Python sidecar,
`fyf-backend-x86_64-pc-windows-msvc.exe`) are frequently flagged as false
positives by AV engines precisely because they're unsigned single-file
executables. Signing both the sidecar and the final Tauri bundle reduces both
problems; SmartScreen reputation also improves over time with a signed,
consistently-used certificate.

### What's needed
- A code signing certificate (standard or EV) from a CA, as a `.pfx`/`.p12`
  plus password, or access to an EV certificate on a HSM/cloud signing service
  (e.g. Azure Trusted Signing, DigiCert KeyLocker) if pursuing EV for instant
  SmartScreen reputation.
- Wire it into `tauri-action` similarly via secrets
  (`WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`) and
  `bundle.windows.certificateThumbprint` / `digestAlgorithm` /
  `timestampUrl` in `tauri.conf.json`, or sign the PyInstaller sidecar
  separately with `signtool` before the Tauri build step picks it up.

This is lower priority than macOS notarization for this project but is noted
here so it isn't lost.
