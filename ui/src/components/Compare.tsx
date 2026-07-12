import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePhotosStore } from "@/lib/stores";
import { useLocale } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { Photo } from "@/lib/api";

// One transform shared across every cell — this is what makes zoom/pan synchronized.
interface Transform {
  scale: number;
  x: number;
  y: number;
}

const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };
const MIN_SCALE = 1;
const MAX_SCALE = 8;

function destStyle(destination: string): {
  color: string;
  tKey: "review.keep" | "review.maybe" | "review.reject";
} {
  if (destination === "keep") return { color: "bg-green-500/15 text-green-400", tKey: "review.keep" };
  if (destination === "maybe") return { color: "bg-amber-500/15 text-amber-400", tKey: "review.maybe" };
  return { color: "bg-red-500/15 text-red-400", tKey: "review.reject" };
}

export function Compare() {
  const { comparePhotos, setComparePhotos, setSummary, updatePhotoDestination } =
    usePhotosStore();
  const { t } = useLocale();

  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const dragState = useRef<{ dragging: boolean; startX: number; startY: number; origX: number; origY: number }>({
    dragging: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const open = comparePhotos != null && comparePhotos.length >= 2;

  const close = useCallback(() => {
    setComparePhotos(null);
    setTransform(IDENTITY);
  }, [setComparePhotos]);

  // Reset transform whenever the compared set changes.
  useEffect(() => {
    setTransform(IDENTITY);
  }, [comparePhotos]);

  // Escape closes (capture phase so it wins over the grid's global handler).
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [open, close]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTransform((prev) => {
      const delta = -e.deltaY * 0.0015;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * (1 + delta)));
      // Snap back to centered when fully zoomed out.
      if (nextScale <= MIN_SCALE) return IDENTITY;
      return { ...prev, scale: nextScale };
    });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (transform.scale <= MIN_SCALE) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: transform.x,
      origY: transform.y,
    };
  }, [transform]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragState.current;
    if (!d.dragging) return;
    setTransform((prev) => ({
      ...prev,
      x: d.origX + (e.clientX - d.startX),
      y: d.origY + (e.clientY - d.startY),
    }));
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragState.current.dragging = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  const refreshSummary = useCallback(async () => {
    const summaryRes = await api.getSummary();
    setSummary(summaryRes);
  }, [setSummary]);

  const handleOverride = useCallback(
    async (photoId: string, dest: string) => {
      try {
        await api.setOverride(photoId, dest);
        updatePhotoDestination(photoId, dest);
        // Reflect the new destination in the compared set's badges.
        setComparePhotos(
          (comparePhotos ?? []).map((p) =>
            p.id === photoId ? { ...p, destination: dest } : p
          )
        );
        await refreshSummary();
      } catch (err) {
        console.error("Failed to override:", err);
      }
    },
    [comparePhotos, setComparePhotos, updatePhotoDestination, refreshSummary]
  );

  const handleKeepThis = useCallback(
    async (keepId: string) => {
      if (!comparePhotos) return;
      const rejectIds = comparePhotos.map((p) => p.id).filter((id) => id !== keepId);
      try {
        await api.setOverride(keepId, "keep");
        updatePhotoDestination(keepId, "keep");
        if (rejectIds.length > 0) {
          await api.setBatchOverride(rejectIds, "reject");
          for (const id of rejectIds) updatePhotoDestination(id, "reject");
        }
        setComparePhotos(
          comparePhotos.map((p) => ({
            ...p,
            destination: p.id === keepId ? "keep" : "reject",
          }))
        );
        await refreshSummary();
      } catch (err) {
        console.error("Failed to keep-this-reject-others:", err);
      }
    },
    [comparePhotos, setComparePhotos, updatePhotoDestination, refreshSummary]
  );

  if (!open || !comparePhotos) return null;

  const count = comparePhotos.length;
  const gridCols =
    count === 2 ? "grid-cols-2" : count === 3 ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-4";

  const transformStyle = {
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
  };

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-black/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
        <h3 className="text-sm font-semibold text-white">{t("compare.title")}</h3>
        <span className="text-xs text-white/40">{t("compare.hint")}</span>
        <button
          onClick={close}
          className="ml-auto rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          aria-label="Close compare view"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Grid of synchronized panes */}
      <div className={cn("grid min-h-0 flex-1 gap-px bg-white/10", gridCols)}>
        {comparePhotos.map((photo: Photo) => {
          const ds = destStyle(photo.destination);
          const score = photo.quality_score ?? 0;
          return (
            <div key={photo.id} className="relative flex min-h-0 flex-col bg-black">
              {/* Cell header */}
              <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
                <span className="truncate text-xs font-medium text-white/90">
                  {photo.filename}
                </span>
                <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                  {Math.round(score)}
                </span>
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", ds.color)}>
                  {t(ds.tKey)}
                </span>
                {photo.is_group_best && (
                  <span className="flex items-center gap-0.5 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-black">
                    <Star className="size-2.5" />
                    {t("compare.auto_pick")}
                  </span>
                )}
              </div>

              {/* Synchronized image pane */}
              <div
                className="relative min-h-0 flex-1 overflow-hidden bg-black"
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onDoubleClick={() => setTransform(IDENTITY)}
                style={{ cursor: transform.scale > MIN_SCALE ? "grab" : "default" }}
              >
                <img
                  src={api.fullUrl(photo.id)}
                  alt={photo.filename}
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                  style={transformStyle}
                />
              </div>

              {/* Cell actions */}
              <div className="flex items-center gap-1.5 border-t border-white/5 px-3 py-2">
                <button
                  className="flex-1 rounded bg-green-500/15 py-1 text-green-400 transition-colors hover:bg-green-500/25"
                  onClick={() => handleOverride(photo.id, "keep")}
                  title={t("review.moveToKeep")}
                >
                  <Check className="mx-auto size-3.5" />
                </button>
                <button
                  className="flex-1 rounded bg-amber-500/15 py-1 text-amber-400 transition-colors hover:bg-amber-500/25"
                  onClick={() => handleOverride(photo.id, "maybe")}
                  title={t("review.moveToMaybe")}
                >
                  <Star className="mx-auto size-3.5" />
                </button>
                <button
                  className="flex-1 rounded bg-red-500/15 py-1 text-red-400 transition-colors hover:bg-red-500/25"
                  onClick={() => handleOverride(photo.id, "reject")}
                  title={t("review.moveToReject")}
                >
                  <Trash2 className="mx-auto size-3.5" />
                </button>
                <Button
                  size="xs"
                  className="gap-1 bg-gradient-to-r from-amber-500 to-yellow-500 font-semibold text-black hover:from-amber-400 hover:to-yellow-400"
                  onClick={() => handleKeepThis(photo.id)}
                >
                  {t("compare.keep_this")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
