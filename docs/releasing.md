# Release downloads

README downloads use GitHub's `/releases/latest/download/<asset>` links with stable filenames. Each release publishes six additional installer copies with those names. The link automatically resolves to the latest stable release; no version edit or bot commit to README is needed.

The existing Release workflow runs `scripts/prepare_release_downloads.py` after collecting build artifacts. The script validates exactly one nonempty installer per platform, then copies the files into `stable-downloads/` for publication alongside the versioned assets. A missing or ambiguous platform fails the job before publishing. Updater archives and signatures remain separate from the stable README copies.

Create releases with the repository's Release workflow (a version tag or manual dispatch). A manually uploaded release must include the stable download copies too; README links depend on those filenames being present in whichever release GitHub marks as latest.

To prepare copies for an existing release, download its six installers into a temporary source directory, then run:

```bash
python3 scripts/prepare_release_downloads.py /tmp/release-installers /tmp/stable-downloads
# Use the actual tag; uploading adds the aliases without replacing original assets.
gh release upload v0.2.1 /tmp/stable-downloads/*
```

The `v0.2.1` release was backfilled when this automation was introduced. The alias contents are identical to the corresponding versioned installers.

## Signed automatic updates

`scripts/generate_updater_manifest.py` validates exactly one nonempty updater and its adjacent signature for each supported platform. It normalizes spaces to dots in artifact filenames before upload (without changing their bytes), rejects duplicate upload names, and writes JSON using those exact filenames. This prevents GitHub filename normalization from breaking download URLs. Missing or ambiguous artifacts abort publication.

The v0.2.1 manifest was repaired in place: only its four download URLs changed, using GitHub's actual asset URLs. Signatures and binaries were preserved. Clients can download again without a new build. Older clients lack the native restart plugin; if installation finishes but the old popup returns, quit and reopen the app once. Version 0.2.2 registers the restart plugin and permission, shows download/install failures, and retries a failed restart without reinstalling.

Before publishing, bump the Python, frontend and Tauri package/config versions together and regenerate Cargo.lock. After publishing, check every manifest URL and stable README download URL returns HTTP 200; confirm signatures and platform architectures match. Browser regression tests mock the native updater and do not replace a signed, packaged macOS upgrade test.

## macOS package signatures and architecture

macOS releases use a complete ad-hoc app signature (`bundle.macOS.signingIdentity: "-"`). This is separate from the updater's `TAURI_SIGNING_PRIVATE_KEY`: updater signatures authenticate downloaded updates but do not sign a macOS app bundle for Gatekeeper.

Version 0.2.3 had only the compiler's linker signature on the main executable, without a sealed resource envelope. Its official ARM DMG passes the published SHA256 checksum, but `codesign --verify --deep --strict` fails with `code has no resources but signature indicates they must be present`. The 0.2.4 configuration signs the full bundle before the DMG and updater archive are created.

Before upload, `scripts/verify_macos_bundle.py` checks the resource seal, signatures and architecture of both the UI and Python backend. The gate also launches the signed backend with a temporary data directory and checks its local HTTP API. A broken or unstartable bundle fails the release job. Apple Silicon builds run on `macos-15`; Intel builds run on `macos-15-intel`. PyInstaller builds for its host architecture, so cross-compiling only Rust on an ARM runner does not produce a working Intel package.

Ad-hoc signing is not Apple Developer ID signing or notarization. Users may still need **System Settings → Privacy & Security → Open Anyway** for a downloaded app they trust. See [Tauri's ad-hoc signing guidance](https://v2.tauri.app/distribute/sign/macos/#ad-hoc-signing) and [Apple's opening guidance](https://support.apple.com/en-gb/102445). Do not advertise these releases as Apple-verified.

For a future Developer ID release, obtain an organization account and a **Developer ID Application** certificate. Configure the exported certificate and signing identity in CI, and add notarization credentials as described in [Tauri's macOS signing guide](https://v2.tauri.app/distribute/sign/macos/). Notarization must be completed before publishing. Keep credentials in GitHub Actions secrets, never in the repository.

Eligible nonprofit legal entities can request a membership fee waiver during organization enrollment. Apple requires that the organization not offer paid apps/in-app purchases under the Paid Applications Agreement or otherwise sell digital goods/services through its apps, and reviews eligibility/documentation. Approval is not automatic. See [Apple Developer Program fee waivers](https://developer.apple.com/help/account/membership/fee-waivers).

`Entitlements.plist` allows loading the Python libraries extracted by PyInstaller (`com.apple.security.cs.disable-library-validation`). Without this entitlement, the otherwise valid hardened-runtime signature causes Python startup to fail with a library Team ID mismatch. Hardened runtime remains enabled; no system-wide Gatekeeper settings are changed. Reassess this exception when the embedded Python libraries can all be signed with the same Developer ID.
