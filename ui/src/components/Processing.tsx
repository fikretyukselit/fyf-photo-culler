import { useEffect, useRef, useState } from "react";
import { CheckCircle, Circle, Loader2, XCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/lib/stores";
import { useProgressStore } from "@/lib/stores";
import { usePhotosStore } from "@/lib/stores";
import { useLocale } from "@/lib/i18n";
import { api } from "@/lib/api";

const STAGE_KEYS = [
  { key: "scanning", tKey: "processing.scanning" as const, order: 0 },
  { key: "analysis", tKey: "processing.technical" as const, order: 1 },
  { key: "duplicates", tKey: "processing.duplicates" as const, order: 2 },
];

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Processing() {
  const { setScreen } = useSessionStore();
  const { progress, setProgress, startTime, setStartTime, reset } =
    useProgressStore();
  const { setPhotos, setSummary, setActiveCategory } = usePhotosStore();
  const { t } = useLocale();

  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Elapsed timer
  useEffect(() => {
    if (!startTime) setStartTime(Date.now());
    const interval = setInterval(() => {
      const st = useProgressStore.getState().startTime;
      if (st) setElapsed((Date.now() - st) / 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, setStartTime]);

  // SSE connection
  useEffect(() => {
    const es = api.progressStream();
    esRef.current = es;

    es.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        setProgress(data);

        if (data.stage === "complete") {
          es.close();
          // Fetch photos and summary
          const [photosRes, summaryRes] = await Promise.all([
            api.getPhotos(undefined, 1, 100),
            api.getSummary(),
          ]);
          setPhotos(photosRes.photos);
          setSummary(summaryRes);
          setActiveCategory("keep");
          setScreen("review");
        } else if (data.stage === "error" || data.stage === "cancelled") {
          es.close();
          setError(
            data.stage === "cancelled"
              ? "Analysis was cancelled."
              : data.current_file || "An error occurred during analysis."
          );
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      setError("Lost connection to analysis process.");
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [setProgress, setPhotos, setSummary, setActiveCategory, setScreen]);

  async function handleCancel() {
    setCancelling(true);
    try {
      await api.cancel();
    } catch {
      // ignore
    }
  }

  function handleBack() {
    reset();
    setScreen("landing");
  }

  function handleRetry() {
    reset();
    setError(null);
    // Re-trigger analysis from landing
    setScreen("landing");
  }

  const stageEntries = [...STAGE_KEYS].sort((a, b) => a.order - b.order);

  // Determine current active stage index
  const activeStageKey = progress?.stage || "";

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      {/* Subtle background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[400px] w-[400px] rounded-full bg-purple-700/15 blur-[120px]" />
        <div className="absolute -right-32 -bottom-32 h-[400px] w-[400px] rounded-full bg-blue-700/15 blur-[120px]" />
      </div>

      <div className="glass relative z-10 mx-4 w-full max-w-md rounded-2xl p-8">
        {error ? (
          <>
            <div className="mb-6 flex flex-col items-center gap-3">
              <XCircle className="size-12 text-red-400" />
              <h2 className="text-xl font-semibold">{t("processing.failed")}</h2>
              <p className="text-center text-sm text-muted-foreground">{error}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 gap-2" onClick={handleBack}>
                <ArrowLeft className="size-4" />
                {t("processing.back")}
              </Button>
              <Button className="flex-1 gap-2" onClick={handleRetry}>
                <RotateCcw className="size-4" />
                {t("processing.retry")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-6 text-center text-xl font-semibold">
              {t("processing.title")}
            </h2>

            {/* Overall progress */}
            <div className="mb-6 flex flex-col items-center gap-2">
              <span className="text-4xl font-bold tabular-nums text-amber-400">
                {progress?.pct ?? 0}%
              </span>
              <span className="text-sm text-muted-foreground">
                {t("processing.elapsed")}: {formatElapsed(elapsed)}
              </span>
            </div>

            {/* Stages */}
            <div className="mb-6 space-y-3">
              {stageEntries.map((stage) => {
                const stageData = progress?.stages?.[stage.key];
                const isDone = stageData && stageData.pct >= 100;
                const isActive = activeStageKey === stage.key;
                const isPending = !isDone && !isActive;

                return (
                  <div key={stage.key} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      {isDone ? (
                        <CheckCircle className="size-4 shrink-0 text-green-400" />
                      ) : isActive ? (
                        <Loader2 className="size-4 shrink-0 animate-spin text-amber-400" />
                      ) : (
                        <Circle className="size-4 shrink-0 text-foreground/20" />
                      )}
                      <span
                        className={cn(
                          "flex-1 text-sm",
                          isDone && "text-muted-foreground",
                          isActive && "font-medium text-foreground",
                          isPending && "text-foreground/30"
                        )}
                      >
                        {t(stage.tKey)}
                      </span>
                      {stageData && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {stageData.current}/{stageData.total}
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="ml-6 h-1.5 overflow-hidden rounded-full bg-foreground/5">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isDone && "bg-green-500",
                          isActive && "bg-amber-400",
                          isPending && "bg-foreground/10"
                        )}
                        style={{ width: `${stageData?.pct ?? 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current file */}
            {progress?.current_file && (
              <p className="mb-6 truncate text-center text-xs text-muted-foreground">
                {progress.current_file}
              </p>
            )}

            {/* Cancel button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? t("processing.cancelling") : t("processing.cancel")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
