import { useState } from "react";
import {
  BookOpen,
  Check,
  Files,
  HardDrive,
  ScanEye,
  Wifi,
  X,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import notice from "@/content/use-notice.json";
import license from "../../../LICENSE?raw";
import { useLocale } from "@/lib/i18n";
import { acceptNotice } from "@/lib/use-notice";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import fyfIcon from "@/assets/orta.png";

const summaryIcons = [HardDrive, Files, ScanEye];

export function UsageNotice({
  required,
  onAccepted,
  onClose,
}: {
  required: boolean;
  onAccepted: () => void;
  onClose: () => void;
}) {
  const { locale, setLocale } = useLocale();
  const copy = notice[locale];
  const [checked, setChecked] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const dialogRef = useDialogFocus(true);

  function accept() {
    if (!checked) return;
    try {
      acceptNotice(locale);
      onAccepted();
    } catch {
      setError(copy.saveError);
    }
  }

  async function decline() {
    setChecked(false);
    setError("");
    setDeclined(true);
    if (!("__TAURI_INTERNALS__" in window)) return;
    setClosing(true);
    try {
      await getCurrentWindow().close();
    } catch {
      setError(copy.closeError);
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/85 p-3 backdrop-blur-md sm:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-title"
        aria-describedby="notice-description"
        tabIndex={-1}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape" && !required) onClose();
        }}
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-[1020px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl outline-none sm:max-h-[calc(100dvh-48px)]"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3 sm:px-7">
          <div className="flex items-center gap-2.5 text-sm font-semibold">
            <img src={fyfIcon} alt="FYF" className="h-6 w-auto" />
            <span>Photo Culler</span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex rounded-lg border border-border p-0.5"
              aria-label="Language / Dil"
            >
              {(["en", "tr"] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  aria-pressed={locale === language}
                  onClick={() => {
                    setChecked(false);
                    setError("");
                    setLocale(language);
                  }}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${locale === language ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {language === "en" ? "English" : "Türkçe"}
                </button>
              ))}
            </div>
            {!required && (
              <button
                aria-label={copy.close}
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </header>

        {declined ? (
          <div className="space-y-5 px-7 py-12">
            <h1
              id="notice-title"
              className="text-2xl font-semibold tracking-tight"
            >
              {copy.declinedTitle}
            </h1>
            <p
              id="notice-description"
              className="max-w-lg text-sm leading-6 text-muted-foreground"
            >
              {copy.declinedBody}
            </p>
            {!("__TAURI_INTERNALS__" in window) && (
              <p className="text-sm">{copy.browserClose}</p>
            )}
            {error && (
              <p role="alert" className="text-sm text-reject">
                {error}
              </p>
            )}
            <button
              disabled={closing}
              onClick={() => {
                setDeclined(false);
                setError("");
              }}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              {copy.readAgain}
            </button>
          </div>
        ) : (
          <>
            <div
              role="region"
              aria-label={copy.documentTitle}
              tabIndex={0}
              className="min-h-0 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <div className="grid md:grid-cols-[340px_minmax(0,1fr)]">
                <aside className="border-b border-border bg-background/60 px-5 py-6 sm:px-7 md:border-r md:border-b-0 md:py-8">
                  <h1
                    id="notice-title"
                    className="text-[27px] leading-[1.15] font-semibold tracking-tight"
                  >
                    {required ? copy.title : copy.reviewTitle}
                  </h1>
                  <p className="mt-4 text-base font-medium leading-6">
                    {copy.intro}
                  </p>
                  <p
                    id="notice-description"
                    className="mt-2 text-sm leading-6 text-muted-foreground"
                  >
                    {copy.description}
                  </p>
                  <ul className="mt-7 space-y-6">
                    {copy.summary.map((item, index) => {
                      const Icon = summaryIcons[index];
                      return (
                        <li key={item.title} className="flex items-start gap-3">
                          <Icon
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-primary"
                          />
                          <div>
                            <h2 className="text-sm font-semibold leading-5">
                              {item.title}
                            </h2>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {item.body}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-7 flex items-start gap-3 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
                    <Wifi
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0"
                    />
                    <p>{copy.networkNote}</p>
                  </div>
                </aside>
                <article
                  aria-label={copy.documentTitle}
                  className="min-w-0 px-5 py-6 sm:px-7 md:py-8"
                >
                  <div className="mb-7 border-b border-border pb-5">
                    <div className="flex items-center gap-2">
                      <BookOpen
                        aria-hidden="true"
                        className="size-4 text-muted-foreground"
                      />
                      <h2 className="text-base font-semibold">
                        {copy.documentTitle}
                      </h2>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {copy.versionLabel} {notice.version}
                      <br />
                      {copy.dateLabel}:{" "}
                      {new Intl.DateTimeFormat(
                        locale === "tr" ? "tr-TR" : "en-GB",
                        { dateStyle: "long", timeZone: "UTC" },
                      ).format(new Date(notice.effectiveDate))}
                    </p>
                  </div>
                  <div className="space-y-6">
                    {copy.sections.map((section) => (
                      <section key={section.title}>
                        <h3 className="text-sm font-semibold leading-6">
                          {section.title}
                        </h3>
                        {section.paragraphs.map((paragraph) => (
                          <p
                            key={paragraph}
                            className="mt-2 text-[13px] leading-[1.8] text-muted-foreground"
                          >
                            {paragraph}
                          </p>
                        ))}
                      </section>
                    ))}
                  </div>
                  <details className="mt-7 border-t border-border pt-4">
                    <summary className="cursor-pointer text-sm font-medium">
                      {copy.licenseLabel}
                    </summary>
                    <pre className="mt-4 whitespace-pre-wrap break-words font-sans text-xs leading-6 text-muted-foreground">
                      {license}
                    </pre>
                  </details>
                </article>
              </div>
            </div>
            <footer className="shrink-0 space-y-3 border-t border-border bg-card px-5 py-4 sm:px-7">
              {error && (
                <p role="alert" className="text-sm text-reject">
                  {error}
                </p>
              )}
              {required ? (
                <>
                  <label className="flex cursor-pointer items-start gap-3 text-sm font-medium leading-5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setChecked(event.target.checked);
                        setError("");
                      }}
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />
                    <span>{copy.acknowledgment}</span>
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {copy.localReceipt}
                    </p>
                    <div className="flex w-full gap-2 sm:w-auto">
                      <button
                        onClick={() => void decline()}
                        className="flex-1 rounded-lg border border-border px-3 py-2.5 text-xs font-medium hover:bg-muted sm:flex-none sm:px-4 sm:text-sm"
                      >
                        {copy.decline}
                      </button>
                      <button
                        disabled={!checked}
                        onClick={accept}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-4 sm:text-sm"
                      >
                        <Check aria-hidden="true" className="size-4 shrink-0" />
                        {copy.accept}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex justify-end">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
                  >
                    {copy.close}
                  </button>
                </div>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
