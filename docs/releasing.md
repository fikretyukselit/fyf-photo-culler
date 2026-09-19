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
