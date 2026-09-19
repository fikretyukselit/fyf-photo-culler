import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useLocale } from "@/lib/i18n";
import { useDialogFocus } from "@/lib/use-dialog-focus";

type Phase =
  | "available"
  | "downloading"
  | "installing"
  | "restarting"
  | "installed"
  | "failed"
  | "restart-failed";

export function UpdatePopup() {
  const { t } = useLocale();
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<Phase>("available");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const busy = useRef(false);
  const installed = useRef(false);
  const dialogRef = useDialogFocus(!!update && !dismissed);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let resource: Update | null = null;
    void check({ timeout: 15000 })
      .then((result) => {
        resource = result;
        if (cancelled) void result?.close().catch(() => {});
        else setUpdate(result);
      })
      .catch((reason) => console.warn("Update check failed", reason));
    return () => {
      cancelled = true;
      void resource?.close().catch(() => {});
    };
  }, []);

  async function installOrRestart() {
    if (!update || busy.current) return;
    busy.current = true;
    setError("");
    try {
      if (!installed.current) {
        setPhase("downloading");
        setProgress(null);
        let downloaded = 0;
        let total = 0;
        await update.downloadAndInstall(
          (event) => {
            if (event.event === "Started") {
              total = event.data.contentLength ?? 0;
              downloaded = 0;
              setProgress(total > 0 ? 0 : null);
            } else if (event.event === "Progress") {
              downloaded += event.data.chunkLength;
              if (total > 0)
                setProgress(
                  Math.min(100, Math.round((downloaded / total) * 100)),
                );
            } else if (event.event === "Finished") {
              setPhase("installing");
            }
          },
          { timeout: 300000 },
        );
        installed.current = true;
      }
      setPhase("restarting");
      await relaunch();
      setPhase("installed");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setPhase(installed.current ? "restart-failed" : "failed");
    } finally {
      busy.current = false;
    }
  }

  if (!update || dismissed) return null;
  const working = ["downloading", "installing", "restarting"].includes(phase);
  const done = installed.current;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-title"
        tabIndex={-1}
        className="glass mx-4 w-full max-w-sm space-y-5 rounded-2xl border border-border p-6 shadow-2xl outline-none"
      >
        <div>
          <h2
            id="update-title"
            className="text-lg font-semibold text-foreground"
          >
            {t(done ? "update.installed" : "update.available")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            v{update.version}
          </p>
        </div>
        {done && (
          <p className="text-sm text-muted-foreground">
            {t("update.restartHint")}
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="space-y-1 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm"
          >
            <p className="font-medium">
              {t(done ? "update.restartFailed" : "update.failed")}
            </p>
            <p className="break-words text-muted-foreground">{error}</p>
          </div>
        )}
        {working && (
          <div className="space-y-2" role="status" aria-live="polite">
            <p className="text-sm text-muted-foreground">
              {t(
                phase === "downloading"
                  ? "update.downloading"
                  : phase === "installing"
                    ? "update.installing"
                    : "update.restarting",
              )}
            </p>
            {phase === "downloading" && (
              <>
                <progress
                  aria-label={t("update.downloading")}
                  max={100}
                  value={progress ?? undefined}
                  className="h-2 w-full accent-amber-400"
                />
                {progress !== null && (
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {progress}%
                  </p>
                )}
              </>
            )}
          </div>
        )}
        {!working && (
          <div className="flex gap-3">
            <button
              onClick={() => {
                setDismissed(true);
                void update.close().catch(() => {});
              }}
              className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-foreground/5"
            >
              {t("update.later")}
            </button>
            <button
              onClick={() => void installOrRestart()}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {t(
                done
                  ? "update.restart"
                  : phase === "failed"
                    ? "update.retry"
                    : "update.install",
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
