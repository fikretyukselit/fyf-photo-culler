import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Star, Trash2, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePhotosStore, visiblePhotos, categoryOf } from "@/lib/stores";
import { useLocale } from "@/lib/i18n";
import { api } from "@/lib/api";
import { triage } from "@/lib/triage";

const ZOOM_SCALE = 2.5;

function destBadge(destination: string): string {
  const cat = categoryOf(destination);
  if (cat === "keep") return "bg-green-500/20 text-green-400";
  if (cat === "maybe") return "bg-amber-500/20 text-amber-400";
  return "bg-red-500/20 text-red-400";
}

/**
 * Fullscreen culling loop: one large photo, ←/→ to move, K/M/R to sort with
 * auto-advance, Z/click to zoom. Navigates the same filtered list as the grid.
 */
export function Loupe() {
  const { photos, activeCategory, focusIdx, loupeOpen, setLoupeOpen, setFocusIdx } =
    usePhotosStore();
  const { t } = useLocale();

  const visible = useMemo(
    () => visiblePhotos(photos, activeCategory),
    [photos, activeCategory]
  );
  const idx = Math.min(Math.max(focusIdx, 0), visible.length - 1);
  const photo = visible.length > 0 ? visible[idx] : null;

  const [zoomed, setZoomed] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fullLoaded, setFullLoaded] = useState(false);
  const dragState = useRef({ dragging: false, moved: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  const close = useCallback(() => setLoupeOpen(false), [setLoupeOpen]);

  // Keep the store's focus index in range after triage shrinks the list.
  useEffect(() => {
    if (!loupeOpen) return;
    if (visible.length === 0) {
      close();
    } else if (focusIdx > visible.length - 1) {
      setFocusIdx(visible.length - 1);
    } else if (focusIdx < 0) {
      setFocusIdx(0);
    }
  }, [loupeOpen, visible.length, focusIdx, setFocusIdx, close]);

  // Reset zoom when moving to another photo.
  useEffect(() => {
    setZoomed(false);
    setPan({ x: 0, y: 0 });
    setFullLoaded(false);
  }, [photo?.id]);

  // Preload the neighbours' previews so ←/→ feels instant.
  useEffect(() => {
    if (!loupeOpen) return;
    for (const neighbor of [visible[idx + 1], visible[idx - 1]]) {
      if (neighbor) new Image().src = api.previewUrl(neighbor.id);
    }
  }, [loupeOpen, idx, visible]);

  useEffect(() => {
    if (!loupeOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey) return; // leave undo/redo alone
      switch (e.key.toLowerCase()) {
        case "escape":
          e.stopPropagation();
          e.preventDefault();
          close();
          break;
        case "arrowright":
        case "arrowdown":
          e.preventDefault();
          setFocusIdx(Math.min(idx + 1, visible.length - 1));
          break;
        case "arrowleft":
        case "arrowup":
          e.preventDefault();
          setFocusIdx(Math.max(idx - 1, 0));
          break;
        case "k":
          if (photo) triage([photo.id], "keep");
          break;
        case "m":
          if (photo) triage([photo.id], "maybe");
          break;
        case "r":
          if (photo) triage([photo.id], "reject");
          break;
        case "z":
          setZoomed((z) => !z);
          break;
      }
    }
    // Capture phase so the grid's global handler never sees these keys.
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [loupeOpen, idx, visible.length, photo, setFocusIdx, close]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragState.current = {
        dragging: zoomed,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        origX: pan.x,
        origY: pan.y,
      };
      if (zoomed) (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [zoomed, pan]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragState.current;
    if (!d.dragging) return;
    if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 4) d.moved = true;
    setPan({ x: d.origX + (e.clientX - d.startX), y: d.origY + (e.clientY - d.startY) });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const wasDrag = dragState.current.dragging && dragState.current.moved;
    dragState.current.dragging = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (!wasDrag) {
      setZoomed((z) => !z);
      setPan({ x: 0, y: 0 });
    }
  }, []);

  if (!loupeOpen || !photo) return null;

  const score = photo.quality_score ?? 0;
  const scoreColor =
    score >= 70 ? "bg-green-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";

  // Filmstrip: a window of ~15 thumbs centered on the current photo.
  const stripStart = Math.max(0, Math.min(idx - 7, visible.length - 15));
  const strip = visible.slice(stripStart, stripStart + 15);

  const imageTransform = zoomed
    ? { transform: `translate(${pan.x}px, ${pan.y}px) scale(${ZOOM_SCALE})` }
    : undefined;

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-black/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-2.5">
        <span className="truncate text-sm font-medium text-white/90">{photo.filename}</span>
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white",
            scoreColor
          )}
        >
          {Math.round(score)}
        </span>
        <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", destBadge(photo.destination))}>
          {t(
            categoryOf(photo.destination) === "keep"
              ? "review.keep"
              : categoryOf(photo.destination) === "maybe"
                ? "review.maybe"
                : "review.reject"
          )}
        </span>
        <span className="text-xs tabular-nums text-white/40">
          {t("detail.position", { i: idx + 1, n: visible.length })}
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs text-white/30">
          <ZoomIn className="size-3.5" />
          {t("loupe.zoomHint")}
        </span>
        <button
          onClick={close}
          title={t("loupe.close")}
          className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Image */}
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ cursor: zoomed ? "grab" : "zoom-in", touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          src={api.previewUrl(photo.id)}
          alt={photo.filename}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          style={imageTransform}
        />
        {/* Full resolution only when zoomed in — fades in over the preview. */}
        {zoomed && (
          <img
            src={api.fullUrl(photo.id)}
            alt=""
            draggable={false}
            onLoad={() => setFullLoaded(true)}
            className={cn(
              "pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-150",
              fullLoaded ? "opacity-100" : "opacity-0"
            )}
            style={imageTransform}
          />
        )}
      </div>

      {/* Triage actions */}
      <div className="flex items-center justify-center gap-2 px-5 py-2.5">
        <button
          className="flex items-center gap-1.5 rounded-lg bg-green-500/15 px-4 py-1.5 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/25"
          onClick={() => triage([photo.id], "keep")}
        >
          <Check className="size-4" />
          {t("review.keep")}
          <kbd className="rounded bg-white/10 px-1 text-[10px] text-white/50">K</kbd>
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-4 py-1.5 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/25"
          onClick={() => triage([photo.id], "maybe")}
        >
          <Star className="size-4" />
          {t("review.maybe")}
          <kbd className="rounded bg-white/10 px-1 text-[10px] text-white/50">M</kbd>
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg bg-red-500/15 px-4 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/25"
          onClick={() => triage([photo.id], "reject")}
        >
          <Trash2 className="size-4" />
          {t("review.reject")}
          <kbd className="rounded bg-white/10 px-1 text-[10px] text-white/50">R</kbd>
        </button>
      </div>

      {/* Filmstrip */}
      <div className="flex justify-center gap-1.5 px-5 pb-3">
        {strip.map((p, i) => {
          const realIdx = stripStart + i;
          const cat = categoryOf(p.destination);
          return (
            <button
              key={p.id}
              onClick={() => setFocusIdx(realIdx)}
              className={cn(
                "relative h-14 w-[74px] shrink-0 overflow-hidden rounded-md border-b-2 transition-all",
                cat === "keep"
                  ? "border-b-green-500"
                  : cat === "maybe"
                    ? "border-b-amber-500"
                    : "border-b-red-500",
                realIdx === idx
                  ? "ring-2 ring-amber-400"
                  : "opacity-50 hover:opacity-90"
              )}
            >
              <img
                src={api.thumbnailUrl(p.id)}
                alt={p.filename}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
