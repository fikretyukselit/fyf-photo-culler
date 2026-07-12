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
  ChevronLeft,
  ChevronRight,
  Columns2,
  Filter,
  FolderOpen,
  Image as ImageIcon,
  Keyboard,
  Layers,
  Maximize2,
  Redo2,
  Star,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/lib/stores";
import {
  usePhotosStore,
  countActiveFilters,
  visiblePhotos,
  categoryOf,
  type Density,
} from "@/lib/stores";
import { useLocale } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { Photo, PhotoFilterParams, FolderInfo } from "@/lib/api";
import { triage } from "@/lib/triage";
import { GroupPanel } from "./GroupPanel";
import { Compare } from "./Compare";
import { Loupe } from "./Loupe";

// Maps the store's PhotoFilters to the api query params.
function filtersToParams(f: {
  minScore: number | null;
  maxScore: number | null;
  minIso: number | null;
  maxIso: number | null;
  rejectReason: string | null;
  mismatch: boolean;
}): PhotoFilterParams {
  return {
    min_score: f.minScore,
    max_score: f.maxScore,
    min_iso: f.minIso,
    max_iso: f.maxIso,
    reject_reason: f.rejectReason,
    mismatch: f.mismatch,
  };
}

const REJECT_REASONS = [
  { value: "blurry", tKey: "filter.reason_blurry" as const },
  { value: "dark", tKey: "filter.reason_dark" as const },
  { value: "overexposed", tKey: "filter.reason_overexposed" as const },
  { value: "duplicate", tKey: "filter.reason_duplicate" as const },
  { value: "similar", tKey: "filter.reason_similar" as const },
  { value: "reject", tKey: "filter.reason_reject" as const },
] as const;

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
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-border bg-popover py-1 shadow-xl shadow-black/40">
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

// ─── Filter Panel ────────────────────────────────────────────

function numberOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function FilterPanel() {
  const { filters, setFilters, clearFilters, activeCategory } = usePhotosStore();
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

  const activeCount = countActiveFilters(filters);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
          activeCount > 0
            ? "bg-amber-500/15 text-amber-400"
            : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
        )}
      >
        <Filter className="size-3.5" />
        {t("filter.button")}
        {activeCount > 0 && (
          <span className="rounded-full bg-amber-500/25 px-1.5 py-0.5 text-xs tabular-nums text-amber-300">
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border border-border bg-popover p-3 shadow-xl shadow-black/40">
          {/* Score range */}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("filter.scoreRange")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                placeholder={t("filter.min")}
                value={filters.minScore ?? ""}
                onChange={(e) => setFilters({ minScore: numberOrNull(e.target.value) })}
                className="w-full rounded-md bg-foreground/5 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-400/50"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder={t("filter.max")}
                value={filters.maxScore ?? ""}
                onChange={(e) => setFilters({ maxScore: numberOrNull(e.target.value) })}
                className="w-full rounded-md bg-foreground/5 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-400/50"
              />
            </div>
          </div>

          {/* ISO range */}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("filter.isoRange")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                placeholder={t("filter.min")}
                value={filters.minIso ?? ""}
                onChange={(e) => setFilters({ minIso: numberOrNull(e.target.value) })}
                className="w-full rounded-md bg-foreground/5 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-400/50"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder={t("filter.max")}
                value={filters.maxIso ?? ""}
                onChange={(e) => setFilters({ maxIso: numberOrNull(e.target.value) })}
                className="w-full rounded-md bg-foreground/5 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-400/50"
              />
            </div>
          </div>

          {/* Reject reason (only in reject tab) */}
          {activeCategory === "reject" && (
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("filter.rejectReason")}
              </label>
              <select
                value={filters.rejectReason ?? ""}
                onChange={(e) =>
                  setFilters({ rejectReason: e.target.value === "" ? null : e.target.value })
                }
                className="w-full rounded-md bg-foreground/5 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-400/50"
              >
                <option value="">{t("filter.anyReason")}</option>
                {REJECT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {t(r.tKey)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mismatch toggle */}
          <button
            onClick={() => setFilters({ mismatch: !filters.mismatch })}
            className={cn(
              "mb-3 w-full rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filters.mismatch
                ? "bg-amber-500/20 text-amber-300"
                : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
            )}
          >
            {t("filter.mismatch")}
          </button>

          {/* Clear */}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={clearFilters}
            disabled={activeCount === 0}
          >
            {t("filter.clear")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Folder (SD card) chips ──────────────────────────────────

function FolderChips() {
  const { folderFilter, setFolderFilter } = usePhotosStore();
  const { t } = useLocale();
  const [folders, setFolders] = useState<FolderInfo[]>([]);

  useEffect(() => {
    api
      .getFolders()
      .then((res) => setFolders(res.folders))
      .catch(() => setFolders([]));
  }, []);

  if (folders.length < 2) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/10 px-4 py-1.5">
      <FolderOpen className="size-3.5 shrink-0 text-muted-foreground/60" />
      <button
        onClick={() => setFolderFilter(null)}
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
          folderFilter == null
            ? "bg-amber-500/15 text-amber-400"
            : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
        )}
      >
        {t("folder.all")}
      </button>
      {folders.map((f) => (
        <button
          key={f.path}
          title={f.path}
          onClick={() => setFolderFilter(folderFilter === f.path ? null : f.path)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            folderFilter === f.path
              ? "bg-amber-500/15 text-amber-400"
              : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
          )}
        >
          {f.name}
          <span className="rounded-full bg-foreground/10 px-1.5 text-[10px] tabular-nums">
            {f.count}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Density toggle ──────────────────────────────────────────

const DENSITIES: { key: Density; label: string }[] = [
  { key: "s", label: "S" },
  { key: "m", label: "M" },
  { key: "l", label: "L" },
];

const DENSITY_COL_WIDTH: Record<Density, number> = { s: 156, m: 200, l: 264 };

function DensityToggle() {
  const { density, setDensity } = usePhotosStore();
  const { t } = useLocale();

  return (
    <div
      className="flex items-center rounded-lg bg-foreground/5 p-0.5"
      title={t("review.densityTitle")}
    >
      {DENSITIES.map((d) => (
        <button
          key={d.key}
          onClick={() => setDensity(d.key)}
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
            density === d.key
              ? "bg-foreground/15 text-foreground"
              : "text-muted-foreground hover:text-foreground/70"
          )}
        >
          {d.label}
        </button>
      ))}
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
  onDoubleClick: () => void;
  onOpenGroup: (groupId: string) => void;
}

function PhotoCard({
  photo,
  isSelected,
  isFocused,
  onSelect,
  onClick,
  onDoubleClick,
  onOpenGroup,
}: PhotoCardProps) {
  const { t } = useLocale();
  const [loaded, setLoaded] = useState(false);
  const score = photo.quality_score ?? 0;
  const scoreDot =
    score >= 70 ? "bg-keep" : score >= 40 ? "bg-maybe" : "bg-reject";
  const cat = categoryOf(photo.destination);
  const borderColor =
    cat === "keep"
      ? "border-l-green-500"
      : cat === "maybe"
        ? "border-l-amber-500"
        : "border-l-red-500";
  const inGroup = photo.group_id != null && (photo.group_size ?? 0) > 1;

  return (
    <div className="relative">
      {/* Stacked-layer effect behind grouped cards */}
      {inGroup && (
        <>
          <div className="pointer-events-none absolute inset-0 translate-x-1 translate-y-1 rounded-xl border border-foreground/5 bg-foreground/[0.03]" />
          <div className="pointer-events-none absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-xl border border-foreground/5 bg-foreground/[0.04]" />
        </>
      )}
      <div
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all duration-200",
          "border-l-[3px]",
          borderColor,
          isSelected && "ring-2 ring-amber-400/60",
          isFocused && "ring-2 ring-amber-300",
          "hover:border-foreground/15 hover:shadow-lg hover:shadow-black/30"
        )}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        {/* Thumbnail */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-foreground/5">
          <img
            src={api.thumbnailUrl(photo.id)}
            alt={photo.filename}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-200",
              loaded ? "opacity-100" : "opacity-0"
            )}
          />
          {/* Score badge — quiet dark pill so it never fights the photo */}
          <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white backdrop-blur-sm">
            <span className={cn("size-1.5 rounded-full", scoreDot)} />
            {Math.round(score)}
          </div>
          {/* Group badge */}
          {inGroup && (
            <button
              type="button"
              title={t("group.badge_tooltip")}
              className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/80"
              onClick={(e) => {
                e.stopPropagation();
                onOpenGroup(photo.group_id!);
              }}
            >
              <Layers className="size-3" />
              ×{photo.group_size}
            </button>
          )}
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
    </div>
  );
}

// ─── Photo Detail Panel ──────────────────────────────────────

function PhotoDetail() {
  const {
    photos,
    activeCategory,
    focusIdx,
    detailOpen,
    setDetailOpen,
    setFocusIdx,
    setLoupeOpen,
    setActiveGroupId,
    setSummary,
    updatePhotoDestination,
  } = usePhotosStore();
  const { t } = useLocale();

  const visible = useMemo(
    () => visiblePhotos(photos, activeCategory),
    [photos, activeCategory]
  );
  const idx = Math.min(Math.max(focusIdx, 0), visible.length - 1);
  const photo = detailOpen && visible.length > 0 ? visible[idx] : null;

  if (!photo) return null;

  const score = photo.quality_score ?? 0;
  const scoreColor =
    score >= 70 ? "text-green-400" : score >= 40 ? "text-amber-400" : "text-red-400";

  const bars = [
    { tKey: "detail.sharpness" as const, value: photo.sharpness },
    { tKey: "detail.exposure" as const, value: photo.exposure },
    { tKey: "detail.contrast" as const, value: photo.contrast },
    { tKey: "detail.exifScore" as const, value: photo.exif_score },
  ];

  async function handleReset() {
    await api.resetOverride(photo!.id);
    const [updated, summaryRes] = await Promise.all([
      api.getPhoto(photo!.id),
      api.getSummary(),
    ]);
    updatePhotoDestination(photo!.id, updated.destination);
    setSummary(summaryRes);
  }

  function formatFileSize(bytes: number | null): string {
    if (bytes == null) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="glass relative z-10 flex h-full w-[380px] shrink-0 flex-col overflow-y-auto border-l border-border">
      {/* Header */}
      <div className="flex items-center gap-1 border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-semibold">{t("review.photoDetails")}</h3>
        <span className="ml-1 text-xs tabular-nums text-muted-foreground">
          {t("detail.position", { i: idx + 1, n: visible.length })}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => setFocusIdx(Math.max(idx - 1, 0))}
            disabled={idx <= 0}
            title={t("detail.prev")}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => setFocusIdx(Math.min(idx + 1, visible.length - 1))}
            disabled={idx >= visible.length - 1}
            title={t("detail.next")}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            onClick={() => setLoupeOpen(true)}
            title={t("detail.openLoupe")}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <Maximize2 className="size-4" />
          </button>
          <button
            onClick={() => setDetailOpen(false)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Preview — 1024px derivative, sharp enough to judge focus */}
      <div
        className="group relative aspect-[4/3] w-full shrink-0 cursor-zoom-in overflow-hidden bg-black/40"
        onClick={() => setLoupeOpen(true)}
      >
        <img
          key={photo.id}
          src={api.previewUrl(photo.id)}
          alt={photo.filename}
          decoding="async"
          className="absolute inset-0 h-full w-full object-contain"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/20 group-hover:opacity-100">
          <span className="font-medium text-white drop-shadow-md">{t("review.zoomHint")}</span>
        </div>
      </div>

      <div className="flex-1 space-y-4 p-4">
        {/* File info */}
        <div>
          <p className="font-medium">{photo.filename}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{photo.path}</p>
          {photo.folder && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground/70">
              <FolderOpen className="size-3" />
              {photo.folder.split("/").pop()}
            </p>
          )}
        </div>

        {/* Group link */}
        {photo.group_id != null && (photo.group_size ?? 0) > 1 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs"
            onClick={() => setActiveGroupId(photo.group_id!)}
          >
            <Layers className="size-3.5" />
            {t("group.view", { n: photo.group_size! })}
          </Button>
        )}

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
                    style={{ width: `${Math.min(100, val)}%` }}
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
            <p className="font-medium tabular-nums">{photo.iso ?? "—"}</p>
          </div>
          <div className="rounded-lg bg-white/5 px-2.5 py-2">
            <span className="text-white/40">Shutter</span>
            <p className="font-medium tabular-nums">{photo.shutter_speed ?? "—"}</p>
          </div>
          <div className="rounded-lg bg-white/5 px-2.5 py-2">
            <span className="text-white/40">Aperture</span>
            <p className="font-medium tabular-nums">
              {photo.aperture != null ? `f/${photo.aperture}` : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-white/5 px-2.5 py-2">
            <span className="text-white/40">{t("detail.fileSize")}</span>
            <p className="font-medium tabular-nums">
              {formatFileSize(photo.file_size)}
            </p>
          </div>
        </div>

        {/* Override buttons — optimistic; focus stays put so the next photo
            slides into the panel automatically */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 gap-1.5 bg-green-500/15 text-green-400 hover:bg-green-500/25"
              onClick={() => triage([photo.id], "keep")}
            >
              <Check className="size-3.5" />
              {t("review.keep")}
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-1.5 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
              onClick={() => triage([photo.id], "maybe")}
            >
              <Star className="size-3.5" />
              {t("review.maybe")}
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-1.5 bg-red-500/15 text-red-400 hover:bg-red-500/25"
              onClick={() => triage([photo.id], "reject")}
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
  );
}

// ─── Multi-select Actions Bar ────────────────────────────────

function SelectionBar() {
  const { selectedIds, clearSelection, setComparePhotos } = usePhotosStore();
  const { t } = useLocale();
  const count = selectedIds.size;

  if (count === 0) return null;

  const canCompare = count >= 2 && count <= 4;

  async function handleBatchMove(dest: string) {
    await triage(Array.from(selectedIds), dest);
    clearSelection();
  }

  function handleCompare() {
    const store = usePhotosStore.getState();
    const selected = store.photos.filter((p) => store.selectedIds.has(p.id));
    if (selected.length >= 2 && selected.length <= 4) {
      setComparePhotos(selected);
    }
  }

  return (
    <div className="glass flex items-center gap-3 border-t border-white/10 px-4 py-2">
      <span className="text-sm font-medium text-white/70">
        {count} {t("review.selected")}
      </span>
      {canCompare && (
        <Button
          size="xs"
          className="gap-1 bg-foreground/10 text-foreground hover:bg-foreground/20"
          onClick={handleCompare}
        >
          <Columns2 className="size-3" />
          {t("compare.open")}
        </Button>
      )}
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

// ─── Shortcuts help overlay ──────────────────────────────────

function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (!open) {
        if (e.key === "?") {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }
      // While open, swallow everything; Esc or ? closes.
      e.stopPropagation();
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [open]);

  const rows: { keys: string; tKey: Parameters<typeof t>[0] }[] = [
    { keys: "← → ↑ ↓", tKey: "shortcuts.navigate" },
    { keys: "K / M / R", tKey: "shortcuts.triage" },
    { keys: "Enter", tKey: "shortcuts.loupe" },
    { keys: "Space", tKey: "shortcuts.select" },
    { keys: "A", tKey: "shortcuts.selectAll" },
    { keys: "C", tKey: "shortcuts.compare" },
    { keys: "Z", tKey: "shortcuts.zoom" },
    { keys: "⌘Z / ⌘⇧Z", tKey: "shortcuts.undoRedo" },
    { keys: "Esc", tKey: "shortcuts.close" },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground/70"
      >
        <Keyboard className="size-3.5" />
        {t("shortcuts.hint")}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[105] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass w-full max-w-sm rounded-2xl border border-white/10 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-2">
              <Keyboard className="size-4 text-amber-400" />
              <h3 className="text-sm font-semibold">{t("shortcuts.title")}</h3>
              <button
                onClick={() => setOpen(false)}
                className="ml-auto rounded p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.keys} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">{t(row.tKey)}</span>
                  <kbd className="shrink-0 rounded-md bg-foreground/10 px-2 py-0.5 text-xs font-medium tabular-nums">
                    {row.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Toast ───────────────────────────────────────────────────

function Toast() {
  const { toast } = usePhotosStore();
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed bottom-16 left-1/2 z-[110] -translate-x-1/2 rounded-lg bg-red-500/90 px-4 py-2 text-sm font-medium text-white shadow-lg">
      {toast}
    </div>
  );
}

// ─── Photo Grid (virtualized) ────────────────────────────────

const GAP = 12;
const PAGE_SIZE = 200;
const CARD_CAPTION_HEIGHT = 30;

function PhotoGrid() {
  const {
    photos,
    activeCategory,
    selectedIds,
    sortBy,
    filters,
    folderFilter,
    density,
    reloadToken,
    focusIdx,
    toggleSelect,
    selectRange,
    setFocusIdx,
    setDetailOpen,
    setLoupeOpen,
    setActiveGroupId,
    setPhotos,
  } = usePhotosStore();
  const { t } = useLocale();

  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastClickedIdx = useRef<number>(-1);
  // Bumped on every fresh (page 1) load; in-flight responses from an older
  // generation are dropped so a slow request can't overwrite a newer one.
  const requestGen = useRef(0);

  const colWidth = DENSITY_COL_WIDTH[density];
  const rowHeight = Math.round(colWidth * 0.75) + CARD_CAPTION_HEIGHT;

  // The server already applied category + filters + sort; we only re-check the
  // category so optimistically-triaged photos drop out immediately.
  const filteredPhotos = useMemo(
    () => visiblePhotos(photos, activeCategory),
    [photos, activeCategory]
  );

  // Responsive columns. The skeleton/empty branches render without the
  // container ref, so re-attach when the grid branch (with photos) mounts.
  const hasPhotos = filteredPhotos.length > 0;
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setCols(Math.max(1, Math.floor((w + GAP) / (colWidth + GAP))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [colWidth, hasPhotos]);

  const rowCount = Math.ceil(filteredPhotos.length / cols);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight + GAP,
    overscan: 4,
  });

  // Re-measure when the density (row height) changes.
  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, virtualizer]);

  const loadPhotos = useCallback(async (p: number) => {
    const gen = p === 1 ? ++requestGen.current : requestGen.current;
    setLoading(true);
    try {
      const store = usePhotosStore.getState();
      const res = await api.getPhotos(
        store.activeCategory,
        p,
        PAGE_SIZE,
        filtersToParams(store.filters),
        {
          sort: store.sortBy === "filename" ? "filename" : "score",
          folder: store.folderFilter,
        }
      );
      // Category/filter/sort changed while this request was in flight —
      // discard it; the newer request owns the grid now.
      if (gen !== requestGen.current) return;
      if (p === 1) {
        setPhotos(res.photos);
      } else {
        const current = usePhotosStore.getState().photos;
        const existing = new Set(current.map((ph) => ph.id));
        const newPhotos = res.photos.filter((ph) => !existing.has(ph.id));
        setPhotos([...current, ...newPhotos]);
      }
      const totalPages = Math.ceil(res.total / res.limit);
      setHasMore(p < totalPages);
    } catch {
      // ignore
    }
    if (gen === requestGen.current) setLoading(false);
  }, [setPhotos]);

  // Reload on category/filter/folder/sort change, or when undo/redo bumps
  // reloadToken. Resets pagination and scroll position.
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadPhotos(1);
    containerRef.current?.scrollTo({ top: 0 });
  }, [activeCategory, filters, folderFilter, sortBy, reloadToken, loadPhotos]);

  const loadMore = useCallback(async () => {
    const next = page + 1;
    setPage(next);
    await loadPhotos(next);
  }, [page, loadPhotos]);

  // Load more when scrolling near the bottom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !hasMore) return;
    function handleScroll() {
      if (!el) return;
      const threshold = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (threshold < 600 && !loading) {
        loadMore();
      }
    }
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [hasMore, loading, loadMore]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.metaKey || e.ctrlKey) return; // undo/redo handled elsewhere

      const store = usePhotosStore.getState();

      // Ignore grid shortcuts while an overlay (loupe / compare / group panel)
      // is open. Those overlays handle their own keys in the capture phase.
      if (
        store.loupeOpen ||
        store.comparePhotos != null ||
        store.activeGroupId != null
      )
        return;

      // Triage targets: the selection when one exists, else the focused photo.
      const triageTargets = (): string[] => {
        if (store.selectedIds.size > 0) return Array.from(store.selectedIds);
        if (focusIdx >= 0 && focusIdx < filteredPhotos.length) {
          return [filteredPhotos[focusIdx].id];
        }
        return [];
      };

      switch (e.key.toLowerCase()) {
        case "c": {
          const selected = store.photos.filter((p) => store.selectedIds.has(p.id));
          if (selected.length >= 2 && selected.length <= 4) {
            store.setComparePhotos(selected);
          }
          break;
        }
        case "k":
        case "m": {
          const dest = e.key.toLowerCase() === "k" ? "keep" : "maybe";
          const ids = triageTargets();
          if (ids.length > 0) {
            triage(ids, dest).then(() => {
              if (store.selectedIds.size > 0) store.clearSelection();
            });
          }
          break;
        }
        case "r": {
          const ids = triageTargets();
          if (ids.length > 0) {
            triage(ids, "reject").then(() => {
              if (store.selectedIds.size > 0) store.clearSelection();
            });
          }
          break;
        }
        case "a":
          e.preventDefault();
          store.selectAll();
          break;
        case "enter":
          if (filteredPhotos.length > 0) {
            if (focusIdx < 0) setFocusIdx(0);
            setLoupeOpen(true);
          }
          break;
        case "escape":
          store.clearSelection();
          store.setDetailOpen(false);
          setFocusIdx(-1);
          break;
        case " ":
          e.preventDefault();
          if (focusIdx >= 0 && focusIdx < filteredPhotos.length) {
            store.toggleSelect(filteredPhotos[focusIdx].id);
          }
          break;
        case "arrowright":
          e.preventDefault();
          setFocusIdx(Math.min(focusIdx + 1, filteredPhotos.length - 1));
          break;
        case "arrowleft":
          e.preventDefault();
          setFocusIdx(Math.max(focusIdx - 1, 0));
          break;
        case "arrowdown":
          e.preventDefault();
          setFocusIdx(Math.min(focusIdx + cols, filteredPhotos.length - 1));
          break;
        case "arrowup":
          e.preventDefault();
          setFocusIdx(Math.max(focusIdx - cols, 0));
          break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [filteredPhotos, cols, focusIdx, setFocusIdx, setLoupeOpen]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusIdx >= 0) {
      const rowIdx = Math.floor(focusIdx / cols);
      virtualizer.scrollToIndex(rowIdx, { align: "auto" });
    }
  }, [focusIdx, cols, virtualizer]);

  // First load: skeleton grid instead of a blank screen.
  if (loading && filteredPhotos.length === 0) {
    return (
      <div className="flex-1 overflow-hidden px-4 py-3">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${colWidth}px, 1fr))` }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[4/3] rounded-xl bg-foreground/5" />
              <div className="mt-2 h-2.5 w-2/3 rounded bg-foreground/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (filteredPhotos.length === 0 && !loading) {
    const filtersActive = countActiveFilters(filters) > 0 || folderFilter != null;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/30">
        <ImageIcon className="size-12" />
        <p className="text-sm">
          {filtersActive ? t("filter.noMatches") : t("review.noPhotos")}
        </p>
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
                height: `${rowHeight}px`,
              }}
            >
              {rowPhotos.map((photo, colIdx) => {
                const idx = startIdx + colIdx;
                return (
                  <div
                    key={photo.id}
                    style={{ width: `${colWidth}px` }}
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
                        setFocusIdx(idx);
                        setDetailOpen(true);
                      }}
                      onDoubleClick={() => {
                        setFocusIdx(idx);
                        setLoupeOpen(true);
                      }}
                      onOpenGroup={setActiveGroupId}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {loading && (
        <div className="py-4 text-center text-sm text-white/30">
          {t("review.loading")}
        </div>
      )}
    </div>
  );
}

// ─── Main Review Component ───────────────────────────────────

function UndoRedo() {
  const { canUndo, canRedo, summary, setHistory, setSummary, bumpReload } = usePhotosStore();
  const { t } = useLocale();

  // Keep undo/redo availability fresh — summary changes after every review action.
  useEffect(() => {
    api.getHistory().then(setHistory).catch(() => {});
  }, [summary, setHistory]);

  const run = useCallback(
    async (kind: "undo" | "redo") => {
      try {
        const res = kind === "undo" ? await api.undo() : await api.redo();
        if (res.status === "noop") {
          setHistory(res);
          return;
        }
        setHistory(res);
        const s = await api.getSummary();
        setSummary(s);
        bumpReload();
      } catch (e) {
        console.error(`${kind} failed:`, e);
      }
    },
    [setHistory, setSummary, bumpReload]
  );

  // Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z (or Ctrl+Y) = redo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        run("undo");
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        run("redo");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => run("undo")}
        disabled={!canUndo}
        title={t("history.undo")}
        className="rounded-md p-1.5 text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Undo2 className="size-4" />
      </button>
      <button
        onClick={() => run("redo")}
        disabled={!canRedo}
        title={t("history.redo")}
        className="rounded-md p-1.5 text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Redo2 className="size-4" />
      </button>
    </div>
  );
}

export function Review() {
  const { setScreen } = useSessionStore();
  const { selectedIds, summary, setSummary } = usePhotosStore();
  const { t } = useLocale();

  // Load the summary on mount — entering via session resume skips Processing,
  // so nothing else has fetched it yet.
  useEffect(() => {
    api.getSummary().then(setSummary).catch(() => {});
  }, [setSummary]);

  return (
    <div className="flex h-full flex-col">
      {/* Top bar — z-30 so its dropdowns (sort/filter) stack above the
          absolutely-positioned virtualized grid rows */}
      <div className="glass relative z-30 flex items-center gap-4 border-b border-white/10 px-4 py-2">
        <CategoryTabs />
        <SortDropdown />
        <FilterPanel />
        <UndoRedo />
        <div className="flex-1" />
        <DensityToggle />
        {selectedIds.size > 0 && (
          <span className="text-xs text-white/40">
            {selectedIds.size} {t("review.selected")}
          </span>
        )}
        <span className="text-xs text-white/30">
          {summary.total} {t("review.photosTotal")}
        </span>
      </div>

      {/* Folder (SD card) filter */}
      <FolderChips />

      {/* Main area */}
      <div className="flex min-h-0 flex-1">
        <PhotoGrid />
        <PhotoDetail />
      </div>

      {/* Selection actions bar */}
      <SelectionBar />

      {/* Overlays */}
      <GroupPanel />
      <Compare />
      <Loupe />
      <Toast />

      {/* Bottom bar */}
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2">
        <ShortcutsHelp />
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
