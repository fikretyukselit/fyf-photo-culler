# Usage notice: review and maintenance

The in-app text is maintained in `ui/src/content/use-notice.json`. Review the generated [English](usage-notice.en.md) and [Turkish](usage-notice.tr.md) copies alongside the [MIT License](../LICENSE). Run `python3 scripts/render_usage_notice.py` after editing. Increment the notice `version` for substantive changes and update both languages together. The application version is separate; routine app updates do not reset acceptance.

This is a product disclosure and proposed usage wording prepared for counsel's review, not a representation of legal approval or a guarantee that a checkbox removes liability. Counsel should confirm the legal entity names, wording and enforceability for intended countries and users, including event volunteers and minors. The text preserves non-excludable rights and does not amend MIT permissions. Reference: [OSI's MIT License](https://opensource.org/license/mit); exclusions can be limited by mandatory law, for example [UK Consumer Rights Act, section 65](https://www.legislation.gov.uk/ukpga/2015/15/section/65). No jurisdiction or venue was invented for the Foundation.

## Verified product behavior

- Desktop photo analysis is local; `backend/server.py` binds the processing service to `127.0.0.1`. No analytics or photo-upload code was found in the current application.
- Analysis reads JPEGs/EXIF and creates local derivatives. `backend/persistence.py` saves file paths, analysis and review decisions to the platform app-data directory. The native sidecar starts and may restore a saved session before the acknowledgment UI; this gate does not claim to prevent all local startup reads.
- `backend/routes/export.py` and `culling/utils.py:safe_copy` copy categorized files, including rejection categories, and preserve source metadata. Source photos are not intentionally deleted. An output location can be synchronized by software outside this app.
- `UpdatePopup` is not mounted until acceptance, so application update checks wait for acknowledgment. GitHub sees ordinary network request data when checking/downloading releases.

## Acceptance behavior and limits

First run, an old notice version, missing data or an invalid record opens a blocking notice before the workspace. The checkbox starts unchecked and resets on language change. Escape and clicking outside do not accept or dismiss it. Decline closes the desktop window; in browser development it keeps the workspace closed. No source-photo or export action is initiated by declining.

The version, timestamp, locale and app version are stored under `fyf-use-notice` in the application's local webview storage. Storage failure leaves the gate closed with a retryable error. The record is a local preference; it is editable, removable, not identity-verified and not a cryptographic signature or tamper-proof legal audit trail. No acceptance service or personal-account system was added.

The titlebar book button reopens the same full text, with the MIT License bundled for offline reading. Reopening does not rewrite the receipt. The screen uses an explicit unchecked checkbox, an equal-access decline action and a keyboard-accessible scroll area; there is no forced scroll timer presented as proof of reading.
