import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  FolderOpen,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/lib/stores";
import { usePhotosStore } from "@/lib/stores";
import { useLocale } from "@/lib/i18n";
import { api } from "@/lib/api";

interface ExportPreview {
  keep: string[];
  maybe: string[];
  reject: string[];
  total: number;
}

type ExportState = "idle" | "exporting" | "complete" | "error";

export function Export() {
  const { setScreen, outputDir } = useSessionStore();
  const { summary } = usePhotosStore();
  const { t } = useLocale();

  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [state, setState] = useState<ExportState>("idle");
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Load export preview
  useEffect(() => {
    api.getExportPreview().then(setPreview).catch(() => {});
  }, []);

  function handleExport() {
    setState("exporting");
    setProgress(0);

    const es = api.exportStream();
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.pct != null) setProgress(data.pct);
        if (data.current_file) setCurrentFile(data.current_file);

        if (data.stage === "complete") {
          es.close();
          setState("complete");
        } else if (data.stage === "error") {
          es.close();
          setState("error");
          setError(data.current_file || "Export failed.");
        }
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      es.close();
      setState("error");
      setError("Lost connection during export.");
    };
  }

  async function handleOpenFolder() {
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(outputDir || "./output");
    } catch {
      try {
        const { openPath } = await import("@tauri-apps/plugin-opener");
        await openPath(outputDir || "./output");
      } catch {
        // ignore
      }
    }
  }

  // Cleanup
  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const categories = [
    { key: "keep" as const, tKey: "review.keep" as const, color: "bg-green-500", text: "text-green-400" },
    { key: "maybe" as const, tKey: "review.maybe" as const, color: "bg-amber-500", text: "text-amber-400" },
    { key: "reject" as const, tKey: "review.reject" as const, color: "bg-red-500", text: "text-red-400" },
  ];

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[400px] w-[400px] rounded-full bg-purple-700/15 blur-[120px]" />
        <div className="absolute -right-32 -bottom-32 h-[400px] w-[400px] rounded-full bg-blue-700/15 blur-[120px]" />
      </div>

      <div className="glass relative z-10 mx-4 w-full max-w-lg rounded-2xl p-8">
        {state === "complete" ? (
          /* Success state */
          <>
            <div className="mb-6 flex flex-col items-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-full bg-green-500/15">
                <Check className="size-7 text-green-400" />
              </div>
              <h2 className="text-xl font-semibold">{t("export.complete")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("export.completeDesc")}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => setScreen("review")}
              >
                <ArrowLeft className="size-4" />
                {t("export.backToReview")}
              </Button>
              <Button
                className="flex-1 gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 font-semibold text-black hover:from-amber-400 hover:to-yellow-400"
                onClick={handleOpenFolder}
              >
                <FolderOpen className="size-4" />
                {t("export.openFolder")}
              </Button>
            </div>
          </>
        ) : state === "error" ? (
          /* Error state */
          <>
            <div className="mb-6 flex flex-col items-center gap-3">
              <h2 className="text-xl font-semibold text-red-400">
                {t("export.error")}
              </h2>
              <p className="text-center text-sm text-muted-foreground">{error}</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setScreen("review")}
              >
                {t("export.backToReview")}
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setState("idle");
                  setError(null);
                }}
              >
                {t("export.retry")}
              </Button>
            </div>
          </>
        ) : (
          /* Idle / Exporting */
          <>
            <div className="mb-6 flex items-center gap-3">
              <Package className="size-6 text-amber-400" />
              <h2 className="text-xl font-semibold">{t("export.title")}</h2>
            </div>

            {/* Summary counts */}
            <div className="mb-4 grid grid-cols-3 gap-3">
              {categories.map((cat) => (
                <div
                  key={cat.key}
                  className="rounded-xl bg-foreground/5 p-3 text-center"
                >
                  <p className={cn("text-2xl font-bold tabular-nums", cat.text)}>
                    {summary[cat.key] ?? 0}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t(cat.tKey)}</p>
                </div>
              ))}
            </div>

            {/* Output path */}
            <div className="mb-4 rounded-lg bg-foreground/5 px-3 py-2">
              <span className="text-xs text-muted-foreground">{t("export.outputFolder")}</span>
              <p className="truncate text-sm text-foreground/70">
                {outputDir || t("export.outputDefault")}
              </p>
            </div>

            {/* Preview info */}
            {preview && (
              <div className="mb-6 rounded-lg bg-foreground/5 px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  {preview.total} {t("export.filesOrganized")}
                </span>
              </div>
            )}

            {/* Export progress */}
            {state === "exporting" && (
              <div className="mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("export.exporting")}</span>
                  <span className="tabular-nums text-amber-400">
                    {progress}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-foreground/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {currentFile && (
                  <p className="truncate text-xs text-muted-foreground">
                    {currentFile}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setScreen("review")}
                disabled={state === "exporting"}
              >
                <ArrowLeft className="size-4" />
                {t("export.back")}
              </Button>
              <Button
                className="flex-1 gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 font-semibold text-black hover:from-amber-400 hover:to-yellow-400"
                onClick={handleExport}
                disabled={state === "exporting"}
              >
                {state === "exporting" ? t("export.exporting") : t("export.start")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
