import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const notice = JSON.parse(
  readFileSync(
    new URL("../../src/content/use-notice.json", import.meta.url),
    "utf8",
  ),
);
export const { version: appVersion } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
);

export const noticeVersion: string = notice.version;

export async function seedNoticeAcceptance(page: Page) {
  await page.addInitScript(
    (receipt) => {
      localStorage.setItem("fyf-use-notice", JSON.stringify(receipt));
    },
    {
      version: notice.version,
      acceptedAt: new Date().toISOString(),
      locale: "en",
      appVersion,
    },
  );
}
