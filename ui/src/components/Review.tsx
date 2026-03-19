import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/lib/stores";
import { usePhotosStore } from "@/lib/stores";
import { useLocale } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { Photo } from "@/lib/api";

// ─── Category Tabs ───────────────────────────────────────────

const CATEGORIES = [
  { key: "keep", tKey: "review.keep" as const, color: "bg-green-500", text: "text-green-400", border: "border-green-500" },
  { key: "maybe", tKey: "review.maybe" as const, color: "bg-amber-500", text: "text-amber-400", border: "border-amber-500" },
  { key: "reject", tKey: "review.reject" as const, color: "bg-red-500", text: "text-red-400", border: "border-red-500" },
] as const;

function CategoryTabs() {
  const { activeCategory, setActiveCategory, summary } = usePhotosStore();
  const { t } = useLocale();

  return (
    <div className="flex gap-1">
      {CATEGORIES.map((cat) => {
        const active = activeCategory === cat.key;
        const count =
          summary[cat.key as keyof typeof summary] ?? 0;
        return (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? `${cat.color}/15 ${cat.text}`
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground/70"
            )}
          >
            {t(cat.tKey)}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                active ? `${cat.color}/20` : "bg-foreground/5"
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Sort Dropdown ───────────────────────────────────────────

function SortDropdown() {
  const { sortBy, setSortBy } = usePhotosStore();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const options = [
    { value: "quality_score" as const, tKey: "review.qualityScore" as const },
    { value: "filename" as const, tKey: "review.filename" as const },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg bg-foreground/5 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-foreground/10"
      >
        {t("review.sortBy")}: {t(options.find((o) => o.value === sortBy)!.tKey)}
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <div className="glass absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-lg py-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setSortBy(opt.value);
                setOpen(false);
              }}
              className={cn(
                "w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-foreground/10",
                sortBy === opt.value ? "text-amber-400" : "text-muted-foreground"
              )}
            >
              {t(opt.tKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Photo Card ──────────────────────────────────────────────

interface PhotoCardProps {
  photo: Photo;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onClick: () => void;
}

function PhotoCard({ photo, isSelected, isFocused, onSelect, onClick }: PhotoCardProps) {
  const score = photo.quality_score ?? 0;
  const scoreColor =
    score >= 70 ? "bg-green-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
  const borderColor =
    photo.destination === "keep"
      ? "border-l-green-500"
      : photo.destination === "maybe"
        ? "border-l-amber-500"
        : "border-l-red-500";

  return (
    <div
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl border border-foreground/5 bg-foreground/[0.03] transition-all duration-200",
        "border-l-[3px]",
        borderColor,
        isSelected && "ring-2 ring-amber-400/50",
        isFocused && "ring-2 ring-foreground/30",
        "hover:scale-[1.02] hover:border-foreground/15 hover:shadow-lg hover:shadow-foreground/5"
      )}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-foreground/5">
        <img
          src={api.thumbnailUrl(photo.id)}
          alt={photo.filename}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {/* Score badge */}
        <div
          className={cn(
            "absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white",
            scoreColor
          )}
        >
          {Math.round(score)}
        </div>
        {/* Selection checkbox */}
        <div
          className={cn(
            "absolute left-2 top-2 flex size-5 items-center justify-center rounded border transition-all",
            isSelected
              ? "border-amber-400 bg-amber-400 text-black"
              : "border-foreground/30 bg-background/40 opacity-0 group-hover:opacity-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(e);
          }}
        >
          {isSelected && <Check className="size-3" />}
        </div>
      </div>
      {/* Filename */}
      <div className="px-2 py-1.5">
        <p className="truncate text-xs text-muted-foreground">{photo.filename}</p>
      </div>
    </div>
  );
}

// ─── Photo Detail Panel ──────────────────────────────────────

function PhotoDetail() {
  const { detailPhoto, setDetailPhoto } = usePhotosStore();
  const { t } = useLocale();
  const [isFullscreen, setFullscreen] = useState(false);

  // reset fullscreen when selecting a new photo
  useEffect(() => {
    setFullscreen(false);
  }, [detailPhoto]);

  if (!detailPhoto) return null;

  const photo = detailPhoto;
  const score = photo.quality_score ?? 0;
  const scoreColor =
    score >= 70 ? "text-green-400" : score >= 40 ? "text-amber-400" : "text-red-400";

  const bars = [
    { tKey: "detail.sharpness" as const, value: photo.sharpness },
    { tKey: "detail.exposure" as const, value: photo.exposure },
    { tKey: "detail.contrast" as const, value: photo.contrast },
    { tKey: "detail.exifScore" as const, value: photo.exif_score },
  ];

  async function handleOverride(dest: string) {
    const store = usePhotosStore.getState();
    
    // Find next photo before updating destination (so it's still in the current category)
    let currentPhotos = store.photos.filter((p) => p.destination === store.activeCategory);
    if (store.sortBy === "quality_score") {
      currentPhotos = currentPhotos.sort((a, b) => (b.quality_score ?? 0) - (a.quality_score ?? 0));
    } else {
      currentPhotos = currentPhotos.sort((a, b) => a.filename.localeCompare(b.filename));
    }
    const currentIndex = currentPhotos.findIndex(p => p.id === photo.id);
    const nextPhoto = currentPhotos[currentIndex + 1] || currentPhotos[currentIndex - 1] || null;

    try {
      await api.setOverride(photo.id, dest);
      const summaryRes = await api.getSummary();
      store.setSummary(summaryRes);
      store.updatePhotoDestination(photo.id, dest);
      
      // Always auto-advance to allow rapid curation
      setDetailPhoto(nextPhoto);
    } catch (e) {
      console.error("Failed to override:", e);
    }
  }

  async function handleReset() {
    await api.resetOverride(photo.id);
    const summaryRes = await api.getSummary();
    usePhotosStore.getState().setSummary(summaryRes);
    const updated = await api.getPhoto(photo.id);
    usePhotosStore.getState().updatePhotoDestination(photo.id, updated.destination);
  }

  function formatFileSize(bytes: number | null): string {
    if (bytes == null) return "\u2014";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <>
      <div className="glass flex h-full w-[400px] shrink-0 flex-col overflow-y-auto border-l border-border relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">{t("review.photoDetails")}</h3>
          <button
            onClick={() => setDetailPhoto(null)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Preview */}
        <div 
          className="relative aspect-[4/3] w-full shrink-0 cursor-zoom-in overflow-hidden bg-foreground/5 group"
          onClick={() => setFullscreen(true)}
        >
          <img
            src={api.thumbnailUrl(photo.id)}
            alt={photo.filename}
            className="absolute inset-0 h-full w-full object-contain blur-md opacity-50 transition-transform duration-300 group-hover:scale-105"
          />
          <img
            key={photo.id}
            src={api.thumbnailUrl(photo.id)}
            alt={photo.filename}
            className="absolute inset-0 h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100">
             <span className="text-white font-medium drop-shadow-md">{t("review.zoomHint")}</span>
          </div>
        </div>

      <div className="flex-1 space-y-4 p-4">
        {/* File info */}
        <div>
          <p className="font-medium">{photo.filename}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{photo.path}</p>
        </div>

        {/* Quality score */}
        <div className="flex items-center gap-3">
          <span className={cn("text-3xl font-bold tabular-nums", scoreColor)}>
            {Math.round(score)}
          </span>
          <span className="text-sm text-muted-foreground">{t("detail.quality")}</span>
        </div>

        {/* Score breakdown */}
        <div className="space-y-2">
          {bars.map((bar) => {
            const val = bar.value ?? 0;
            const barColor =
              val >= 70 ? "bg-green-500" : val >= 40 ? "bg-amber-500" : "bg-red-500";
            return (
              <div key={bar.tKey}>
                <div className="mb-0.5 flex justify-between text-xs">
                  <span className="text-muted-foreground">{t(bar.tKey)}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {Math.round(val)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-foreground/5">
                  <div
                    className={cn("h-full rounded-full transition-all", barColor)}
                    style={{ width: `${val}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* EXIF data */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-white/5 px-2.5 py-2">
            <span className="text-white/40">ISO</span>
            <p className="font-medium tabular-nums">{photo.iso ?? "\u2014"}</p>
          </div>
          <div className="rounded-lg bg-white/5 px-2.5 py-2">
            <span className="text-white/40">Shutter</span>
            <p className="font-medium tabular-nums">{photo.shutter_speed ?? "\u2014"}</p>
          </div>
          <div className="rounded-lg bg-white/5 px-2.5 py-2">
            <span className="text-white/40">Aperture</span>
            <p className="font-medium tabular-nums">
              {photo.aperture != null ? `f/${photo.aperture}` : "\u2014"}
            </p>
          </div>
          <div className="rounded-lg bg-white/5 px-2.5 py-2">
            <span className="text-white/40">{t("detail.fileSize")}</span>
            <p className="font-medium tabular-nums">
              {formatFileSize(photo.file_size)}
            </p>
          </div>
        </div>

        {/* Override buttons */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 gap-1.5 bg-green-500/15 text-green-400 hover:bg-green-500/25"
              onClick={() => handleOverride("keep")}
            >
              <Check className="size-3.5" />
              {t("review.keep")}
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-1.5 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
              onClick={() => handleOverride("maybe")}
            >
              <Star className="size-3.5" />
              {t("review.maybe")}
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-1.5 bg-red-500/15 text-red-400 hover:bg-red-500/25"
              onClick={() => handleOverride("reject")}
            >
              <Trash2 className="size-3.5" />
              {t("review.reject")}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={handleReset}
          >
            {t("review.resetOriginal")}
          </Button>
        </div>
      </div>
    </div>
      
    {/* Fullscreen Overlay */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/95 p-8 backdrop-blur-sm"
          onClick={() => setFullscreen(false)}
        >
          {/* Close button top right */}
          <button
            onClick={() => setFullscreen(false)}
            className="absolute right-6 top-6 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <X className="size-6" />
          </button>
          
          <img
            src={api.fullUrl(photo.id)}
            alt={photo.filename}
            className="h-full w-full object-contain drop-shadow-2xl animate-in zoom-in duration-200"
          />
        </div>
      )}
    </>
  );
}

// ─── Multi-select Actions Bar ────────────────────────────────

function SelectionBar() {
  const { selectedIds, clearSelection, setSummary } = usePhotosStore();
  const { t } = useLocale();
  const count = selectedIds.size;

  if (count === 0) return null;

  async function handleBatchMove(dest: string) {
    const ids = Array.from(selectedIds);
    await api.setBatchOverride(ids, dest);
    const summaryRes = await api.getSummary();
    setSummary(summaryRes);
    const store = usePhotosStore.getState();
    for (const id of ids) {
      store.updatePhotoDestination(id, dest);
    }
    clearSelection();
  }

  return (
    <div className="glass flex items-center gap-3 border-t border-white/10 px-4 py-2">
      <span className="text-sm font-medium text-white/70">
        {count} {t("review.selected")}
      </span>
      <div className="flex gap-1.5">
        <Button
          size="xs"
          className="gap-1 bg-green-500/15 text-green-400 hover:bg-green-500/25"
          onClick={() => handleBatchMove("keep")}
        >
          <Check className="size-3" />
          {t("review.keep")}
        </Button>
        <Button
          size="xs"
          className="gap-1 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
          onClick={() => handleBatchMove("maybe")}
        >
          <Star className="size-3" />
          {t("review.maybe")}
        </Button>
        <Button
          size="xs"
          className="gap-1 bg-red-500/15 text-red-400 hover:bg-red-500/25"
          onClick={() => handleBatchMove("reject")}
        >
          <Trash2 className="size-3" />
          {t("review.reject")}
        </Button>
      </div>
      <Button
        variant="ghost"
        size="xs"
        className="ml-auto text-white/40"
        onClick={clearSelection}
      >
        {t("review.clearSelection")}
      </Button>
    </div>
  );
}

// ─── Photo Grid (virtualized) ────────────────────────────────

const COL_WIDTH = 200;
const ROW_HEIGHT = 240;
const GAP = 12;

function PhotoGrid() {
  const {
    photos,
    activeCategory,
    selectedIds,
    sortBy,
    toggleSelect,
    selectRange,
    setDetailPhoto,
    setPhotos,
  } = usePhotosStore();
  const { t } = useLocale();

  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastClickedIdx = useRef<number>(-1);
  const [focusIdx, setFocusIdx] = useState(-1);

  // Filter and sort photos
  const filteredPhotos = useMemo(() => {
    let filtered = photos.filter((p) => p.destination === activeCategory);
    if (sortBy === "quality_score") {
      filtered = [...filtered].sort(
        (a, b) => (b.quality_score ?? 0) - (a.quality_score ?? 0)
      );
    } else {
      filtered = [...filtered].sort((a, b) =>
        a.filename.localeCompare(b.filename)
      );
    }
    return filtered;
  }, [photos, activeCategory, sortBy]);

  // Responsive columns
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setCols(Math.max(1, Math.floor((w + GAP) / (COL_WIDTH + GAP))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rowCount = Math.ceil(filteredPhotos.length / cols);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT + GAP,
    overscan: 3,
  });

  // Load more when scrolling near bottom
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !hasMore) return;
    function handleScroll() {
      if (!el) return;
      const threshold = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (threshold < 400 && !loading && hasMore) {
        loadMore();
      }
    }
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  });

  const loadPhotos = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const cat = usePhotosStore.getState().activeCategory;
      const res = await api.getPhotos(cat, p, 100);
      if (p === 1) {
        setPhotos(res.photos);
      } else {
        const store = usePhotosStore.getState();
        const existing = new Set(store.photos.map((ph) => ph.id));
        const newPhotos = res.photos.filter((ph) => !existing.has(ph.id));
        setPhotos([...store.photos, ...newPhotos]);
      }
      const totalPages = Math.ceil(res.total / res.limit);
      setHasMore(p < totalPages);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [setPhotos]);

  // Reload on category change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadPhotos(1);
    setFocusIdx(-1);
  }, [activeCategory, loadPhotos]);

  const loadMore = useCallback(async () => {
    const next = page + 1;
    setPage(next);
    await loadPhotos(next);
  }, [page, loadPhotos]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const store = usePhotosStore.getState();

      switch (e.key.toLowerCase()) {
        case "k":
          if (store.selectedIds.size > 0) {
            api.setBatchOverride(Array.from(store.selectedIds), "keep").then(() => {
              api.getSummary().then((s) => store.setSummary(s));
              for (const id of store.selectedIds) store.updatePhotoDestination(id, "keep");
              store.clearSelection();
            });
          }
          break;
        case "m":
          if (store.selectedIds.size > 0) {
            api.setBatchOverride(Array.from(store.selectedIds), "maybe").then(() => {
              api.getSummary().then((s) => store.setSummary(s));
              for (const id of store.selectedIds) store.updatePhotoDestination(id, "maybe");
              store.clearSelection();
            });
          }
          break;
        case "r":
          if (store.selectedIds.size > 0) {
            api.setBatchOverride(Array.from(store.selectedIds), "reject").then(() => {
              api.getSummary().then((s) => store.setSummary(s));
              for (const id of store.selectedIds) store.updatePhotoDestination(id, "reject");
              store.clearSelection();
            });
          }
          break;
        case "a":
          store.selectAll();
          break;
        case "escape":
          store.clearSelection();
          store.setDetailPhoto(null);
          setFocusIdx(-1);
          break;
        case " ":
          e.preventDefault();
          if (focusIdx >= 0 && focusIdx < filteredPhotos.length) {
            store.toggleSelect(filteredPhotos[focusIdx].id);
          }
          break;
        case "arrowright":
          setFocusIdx((prev) =>
            Math.min(prev + 1, filteredPhotos.length - 1)
          );
          break;
        case "arrowleft":
          setFocusIdx((prev) => Math.max(prev - 1, 0));
          break;
        case "arrowdown":
          e.preventDefault();
          setFocusIdx((prev) =>
            Math.min(prev + cols, filteredPhotos.length - 1)
          );
          break;
        case "arrowup":
          e.preventDefault();
          setFocusIdx((prev) => Math.max(prev - cols, 0));
          break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [filteredPhotos, cols, focusIdx]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusIdx >= 0) {
      const rowIdx = Math.floor(focusIdx / cols);
      virtualizer.scrollToIndex(rowIdx, { align: "auto" });
    }
  }, [focusIdx, cols, virtualizer]);

  if (filteredPhotos.length === 0 && !loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/30">
        <ImageIcon className="size-12" />
        <p className="text-sm">{t("review.noPhotos")}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-3">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * cols;
          const rowPhotos = filteredPhotos.slice(startIdx, startIdx + cols);

          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 right-0 flex gap-3"
              style={{
                top: `${virtualRow.start}px`,
                height: `${ROW_HEIGHT}px`,
              }}
            >
              {rowPhotos.map((photo, colIdx) => {
                const idx = startIdx + colIdx;
                return (
                  <div
                    key={photo.id}
                    style={{ width: `${COL_WIDTH}px` }}
                  >
                    <PhotoCard
                      photo={photo}
                      isSelected={selectedIds.has(photo.id)}
                      isFocused={focusIdx === idx}
                      onSelect={(e) => {
                        if (e.shiftKey && lastClickedIdx.current >= 0) {
                          const fromPhoto = filteredPhotos[lastClickedIdx.current];
                          if (fromPhoto) {
                            selectRange(fromPhoto.id, photo.id);
                          }
                        } else {
                          toggleSelect(photo.id);
                        }
                        lastClickedIdx.current = idx;
                      }}
                      onClick={() => {
                        setDetailPhoto(photo);
                        setFocusIdx(idx);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {loading && (
        <div className="py-4 text-center text-sm text-white/30">Loading...</div>
      )}
    </div>
  );
}

// ─── Main Review Component ───────────────────────────────────

export function Review() {
  const { setScreen } = useSessionStore();
  const { selectedIds, summary } = usePhotosStore();
  const { t } = useLocale();

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="glass flex items-center gap-4 border-b border-white/10 px-4 py-2">
        <CategoryTabs />
        <SortDropdown />
        <div className="flex-1" />
        {selectedIds.size > 0 && (
          <span className="text-xs text-white/40">
            {selectedIds.size} {t("review.selected")}
          </span>
        )}
        <span className="text-xs text-white/30">
          {summary.total} {t("review.photosTotal")}
        </span>
      </div>

      {/* Main area */}
      <div className="flex min-h-0 flex-1">
        <PhotoGrid />
        <PhotoDetail />
      </div>

      {/* Selection actions bar */}
      <SelectionBar />

      {/* Bottom bar */}
      <div className="flex items-center justify-end border-t border-white/10 px-4 py-2">
        <Button
          className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 font-semibold text-black hover:from-amber-400 hover:to-yellow-400"
          onClick={() => setScreen("export")}
        >
          {t("review.export")}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
