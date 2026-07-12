import { useEffect, useRef, useState } from "react";
import { CheckCircle, Circle, Loader2, XCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/lib/stores";
import { useProgressStore } from "@/lib/stores";
import { usePhotosStore } from "@/lib/stores";
import { useLocale } from "@/lib/i18n";
import { api } from "@/lib/api";

// The three phases shown to the user, in order. The backend emits finer-grained
// stage names ("technical_analysis", "duplicate_detection:hashing", …); we map
// those onto these display phases.
const PHASES = [
  { tKey: "processing.scanning" as const },
  { tKey: "processing.technical" as const },
  { tKey: "processing.duplicates" as const },
];

// Duplicate detection runs three sequential sub-stages.
const DUP_SUBSTAGES = [
  "duplicate_detection:hashing",
  "duplicate_detection:ssim_verification",
  "duplicate_detection:feature_matching",
];

type StageData = { current: number; total: number; pct: number };

function phaseIndex(stage: string): number {
  if (!stage || stage === "starting" || stage === "scanning") return 0;
  if (stage === "technical_analysis") return 1;
  if (stage.startsWith("duplicate_detection")) return 2;
  if (stage === "complete") return 3; // all phases done
  return -1; // error / cancelled / unknown
}

// A single monotonic 0-100 number across the whole job. The backend's own `pct`
// is per-substage (it resets each step), so we weight the phases here: technical
// analysis is the long pole, duplicate detection the tail.
function computeOverall(stage: string, stages: Record<string, StageData>): number {
  if (stage === "complete") return 100;
  const p = phaseIndex(stage);
  if (p < 0) return 0;
  if (p === 0) return 2; // scanning is near-instant
  if (p === 1) {
    const t = stages["technical_analysis"];
    const frac = t && t.total ? t.current / t.total : 0;
    return Math.round(5 + 60 * frac); // 5% → 65%
  }
  // Duplicate detection phase spans 65% → 100%.
  const idx = DUP_SUBSTAGES.indexOf(stage);
  const sub = stages[stage];
  const subFrac = sub && sub.total ? sub.current / sub.total : 0;
  const done = idx < 0 ? 0 : (idx + subFrac) / DUP_SUBSTAGES.length;
  return Math.round(65 + 35 * done);
}

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

  const currentStage = progress?.stage || "";
  const stages = (progress?.stages ?? {}) as Record<string, StageData>;
  const currentPhase = phaseIndex(currentStage);
  const overall = computeOverall(currentStage, stages);

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
                {overall}%
              </span>
              <span className="text-sm text-muted-foreground">
                {t("processing.elapsed")}: {formatElapsed(elapsed)}
              </span>
            </div>

            {/* Stages */}
            <div className="mb-6 space-y-3">
              {PHASES.map((phase, i) => {
                const isDone = currentPhase > i;
                const isActive = currentPhase === i;
                const isPending = currentPhase < i;

                // Per-row live count/progress from the matching backend stage.
                let stageData: StageData | undefined;
                if (i === 1) {
                  stageData = stages["technical_analysis"];
                } else if (i === 2 && isActive) {
                  stageData = stages[currentStage]; // active duplicate sub-stage
                }
                // Scanning reports 0/0, so we never show a count for it.
                const showCount = i > 0 && !!stageData && stageData.total > 0;
                const barPct = isDone ? 100 : isActive ? (stageData?.pct ?? 0) : 0;

                return (
                  <div key={i} className="space-y-1.5">
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
                        {t(phase.tKey)}
                      </span>
                      {showCount && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {stageData!.current}/{stageData!.total}
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
                        style={{ width: `${barPct}%` }}
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
