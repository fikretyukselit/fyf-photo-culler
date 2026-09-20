"""Generate reviewable Markdown from the exact in-app English/Turkish notice.

Run after editing ui/src/content/use-notice.json. Increment its version whenever
substantive terms change so existing users are asked to acknowledge them again.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def render_notice():
    notice = json.loads((ROOT / "ui/src/content/use-notice.json").read_text())
    for locale in ("en", "tr"):
        copy = notice[locale]
        lines = [f"# {copy['documentTitle']}", "",
                 f"{copy['versionLabel']}: {notice['version']}  ",
                 f"{copy['dateLabel']}: {notice['effectiveDate']}", "",
                 copy["intro"], "", copy["description"], ""]
        for summary in copy["summary"]:
            lines += [f"**{summary['title']}** — {summary['body']}", ""]
        lines += [copy["networkNote"], ""]
        for section in copy["sections"]:
            lines += [f"## {section['title']}", ""]
            for paragraph in section["paragraphs"]:
                lines += [paragraph, ""]
        lines += [f"[{copy['licenseLabel']}](../LICENSE)", "",
                  f"- [ ] {copy['acknowledgment']}", "", copy["localReceipt"], ""]
        (ROOT / f"docs/usage-notice.{locale}.md").write_text("\n".join(lines))


if __name__ == "__main__":
    render_notice()
