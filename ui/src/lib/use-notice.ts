import notice from "@/content/use-notice.json";
import { version as appVersion } from "../../package.json";

export const NOTICE_STORAGE_KEY = "fyf-use-notice";
export const NOTICE_VERSION = notice.version;
export type NoticeLocale = "en" | "tr";

export interface NoticeReceipt {
  version: string;
  acceptedAt: string;
  locale: NoticeLocale;
  appVersion: string;
}

/** A local preference, not an authenticated signature or remote audit record. */
export function hasAcceptedNotice(): boolean {
  try {
    const receipt = JSON.parse(
      localStorage.getItem(NOTICE_STORAGE_KEY) ?? "null",
    );
    return (
      !!receipt &&
      receipt.version === NOTICE_VERSION &&
      typeof receipt.acceptedAt === "string" &&
      Number.isFinite(Date.parse(receipt.acceptedAt)) &&
      (receipt.locale === "en" || receipt.locale === "tr") &&
      typeof receipt.appVersion === "string" &&
      receipt.appVersion.length > 0
    );
  } catch {
    return false;
  }
}

export function acceptNotice(locale: NoticeLocale): void {
  const receipt: NoticeReceipt = {
    version: NOTICE_VERSION,
    acceptedAt: new Date().toISOString(),
    locale,
    appVersion,
  };
  const serialized = JSON.stringify(receipt);
  localStorage.setItem(NOTICE_STORAGE_KEY, serialized);
  if (localStorage.getItem(NOTICE_STORAGE_KEY) !== serialized) {
    throw new Error("Acknowledgment was not saved");
  }
}
