import { create } from "zustand";
import type { Photo } from "./api";

export type Screen = "landing" | "processing" | "review" | "export";

export interface Progress {
  stage: string;
  current: number;
  total: number;
  pct: number;
  current_file: string;
  stages: Record<string, { current: number; total: number; pct: number }>;
}

export interface Summary {
  keep: number;
  maybe: number;
  reject: number;
  total: number;
}

// ── Session store ──────────────────────────────────────────────

interface SessionStore {
  screen: Screen;
  inputFolders: string[];
  mergeMode: boolean;
  outputDir: string;
  backendPort: number | null;
  theme: "dark" | "light";
  locale: "en" | "tr";
  onboardingOpen: boolean;
  setOnboardingOpen: (open: boolean) => void;
  setScreen: (screen: Screen) => void;
  addFolder: (folder: string) => void;
  removeFolder: (index: number) => void;
  setMergeMode: (merge: boolean) => void;
  setOutputDir: (dir: string) => void;
  setBackendPort: (port: number) => void;
  toggleTheme: () => void;
  setLocale: (locale: "en" | "tr") => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  screen: "landing",
  inputFolders: [],
  mergeMode: false,
  outputDir: "",
  backendPort: null,
  theme: (localStorage.getItem("fyf-theme") as "dark" | "light") || "dark",
  locale: (localStorage.getItem("fyf-locale") as "en" | "tr") || "en",
  // First launch: play the animated how-it-works tour once.
  onboardingOpen: localStorage.getItem("fyf-onboarding-seen") !== "1",

  setOnboardingOpen: (onboardingOpen) => {
    if (!onboardingOpen) localStorage.setItem("fyf-onboarding-seen", "1");
    set({ onboardingOpen });
  },

  setScreen: (screen) => set({ screen }),

  addFolder: (folder) =>
    set((state) => ({
      inputFolders: state.inputFolders.includes(folder)
        ? state.inputFolders
        : [...state.inputFolders, folder],
    })),

  removeFolder: (index) =>
    set((state) => ({
      inputFolders: state.inputFolders.filter((_, i) => i !== index),
    })),

  setMergeMode: (mergeMode) => set({ mergeMode }),
  setOutputDir: (outputDir) => set({ outputDir }),
  setBackendPort: (backendPort) => set({ backendPort }),

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("fyf-theme", next);
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return { theme: next };
    }),

  setLocale: (locale) => {
    localStorage.setItem("fyf-locale", locale);
    set({ locale });
  },
}));

// ── Photos store ───────────────────────────────────────────────

type SortBy = "quality_score" | "filename";
export type Density = "s" | "m" | "l";

const REJECT_DESTINATIONS = new Set([
  "reject",
  "blurry",
  "dark",
  "overexposed",
  "duplicate",
  "similar",
]);

/** The summary/tab category a destination belongs to. */
export function categoryOf(destination: string): "keep" | "maybe" | "reject" {
  if (destination === "keep" || destination === "maybe") return destination;
  return "reject";
}

// Mirror of the backend's _category_matches so client-side filtering keeps the
// exact set the server returned (reject sub-types belong to the reject tab).
export function categoryMatches(destination: string, category: string): boolean {
  if (category === "reject") return REJECT_DESTINATIONS.has(destination);
  return destination === category;
}

/** Photos currently visible in the grid: the server's order, minus photos
 * whose destination changed since load (optimistic triage removal). */
export function visiblePhotos(photos: Photo[], activeCategory: string): Photo[] {
  return photos.filter((p) => categoryMatches(p.destination, activeCategory));
}

export interface PhotoFilters {
  minScore: number | null;
  maxScore: number | null;
  minIso: number | null;
  maxIso: number | null;
  rejectReason: string | null;
  mismatch: boolean;
}

export const EMPTY_FILTERS: PhotoFilters = {
  minScore: null,
  maxScore: null,
  minIso: null,
  maxIso: null,
  rejectReason: null,
  mismatch: false,
};

export function countActiveFilters(f: PhotoFilters): number {
  let n = 0;
  if (f.minScore != null) n++;
  if (f.maxScore != null) n++;
  if (f.minIso != null) n++;
  if (f.maxIso != null) n++;
  if (f.rejectReason != null) n++;
  if (f.mismatch) n++;
  return n;
}

interface PhotosStore {
  photos: Photo[];
  activeCategory: string;
  selectedIds: Set<string>;
  focusIdx: number;
  detailOpen: boolean;
  loupeOpen: boolean;
  activeGroupId: string | null;
  comparePhotos: Photo[] | null;
  filters: PhotoFilters;
  folderFilter: string | null;
  density: Density;
  summary: Summary;
  sortBy: SortBy;
  canUndo: boolean;
  canRedo: boolean;
  reloadToken: number;
  toast: string | null;
  setHistory: (h: { can_undo: boolean; can_redo: boolean }) => void;
  bumpReload: () => void;
  setPhotos: (photos: Photo[]) => void;
  setActiveCategory: (cat: string) => void;
  toggleSelect: (id: string) => void;
  selectRange: (startId: string, endId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setFocusIdx: (idx: number) => void;
  setDetailOpen: (open: boolean) => void;
  setLoupeOpen: (open: boolean) => void;
  setActiveGroupId: (groupId: string | null) => void;
  setComparePhotos: (photos: Photo[] | null) => void;
  setFilters: (patch: Partial<PhotoFilters>) => void;
  clearFilters: () => void;
  setFolderFilter: (folder: string | null) => void;
  setDensity: (density: Density) => void;
  setSummary: (summary: Summary) => void;
  adjustSummary: (delta: Partial<Summary>) => void;
  setSortBy: (sort: SortBy) => void;
  setToast: (toast: string | null) => void;
  updatePhotoDestination: (id: string, destination: string) => void;
}

export const usePhotosStore = create<PhotosStore>((set) => ({
  photos: [],
  activeCategory: "all",
  selectedIds: new Set<string>(),
  focusIdx: -1,
  detailOpen: false,
  loupeOpen: false,
  activeGroupId: null,
  comparePhotos: null,
  filters: { ...EMPTY_FILTERS },
  folderFilter: null,
  density: (localStorage.getItem("fyf-density") as Density) || "m",
  summary: { keep: 0, maybe: 0, reject: 0, total: 0 },
  sortBy: "quality_score",
  canUndo: false,
  canRedo: false,
  reloadToken: 0,
  toast: null,

  setHistory: ({ can_undo, can_redo }) => set({ canUndo: can_undo, canRedo: can_redo }),
  bumpReload: () => set((state) => ({ reloadToken: state.reloadToken + 1 })),

  setPhotos: (photos) => set({ photos }),

  setActiveCategory: (activeCategory) =>
    set((state) => ({
      activeCategory,
      selectedIds: new Set(),
      focusIdx: -1,
      detailOpen: false,
      loupeOpen: false,
      // The reject-reason filter only applies to the reject tab; drop it
      // elsewhere so it can't silently hide the whole category.
      filters:
        activeCategory === "reject"
          ? state.filters
          : { ...state.filters, rejectReason: null },
    })),

  toggleSelect: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    }),

  selectRange: (startId, endId) =>
    set((state) => {
      const { photos, activeCategory } = state;
      const filtered =
        activeCategory === "all" ? photos : visiblePhotos(photos, activeCategory);

      const startIdx = filtered.findIndex((p) => p.id === startId);
      const endIdx = filtered.findIndex((p) => p.id === endId);

      if (startIdx === -1 || endIdx === -1) return state;

      const lo = Math.min(startIdx, endIdx);
      const hi = Math.max(startIdx, endIdx);

      const next = new Set(state.selectedIds);
      for (let i = lo; i <= hi; i++) {
        next.add(filtered[i].id);
      }
      return { selectedIds: next };
    }),

  selectAll: () =>
    set((state) => {
      const { photos, activeCategory } = state;
      const filtered =
        activeCategory === "all" ? photos : visiblePhotos(photos, activeCategory);
      return { selectedIds: new Set(filtered.map((p) => p.id)) };
    }),

  clearSelection: () => set({ selectedIds: new Set() }),

  setFocusIdx: (focusIdx) => set({ focusIdx }),

  setDetailOpen: (detailOpen) => set({ detailOpen }),

  setLoupeOpen: (loupeOpen) => set({ loupeOpen }),

  setActiveGroupId: (activeGroupId) => set({ activeGroupId }),

  setComparePhotos: (comparePhotos) => set({ comparePhotos }),

  setFilters: (patch) =>
    set((state) => ({ filters: { ...state.filters, ...patch } })),

  clearFilters: () => set({ filters: { ...EMPTY_FILTERS } }),

  setFolderFilter: (folderFilter) =>
    set({ folderFilter, selectedIds: new Set(), focusIdx: -1 }),

  setDensity: (density) => {
    localStorage.setItem("fyf-density", density);
    set({ density });
  },

  setSummary: (summary) => set({ summary }),

  adjustSummary: (delta) =>
    set((state) => ({
      summary: {
        keep: state.summary.keep + (delta.keep ?? 0),
        maybe: state.summary.maybe + (delta.maybe ?? 0),
        reject: state.summary.reject + (delta.reject ?? 0),
        total: state.summary.total + (delta.total ?? 0),
      },
    })),

  setSortBy: (sortBy) => set({ sortBy }),

  setToast: (toast) => set({ toast }),

  updatePhotoDestination: (id, destination) =>
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === id ? { ...p, destination } : p
      ),
    })),
}));

// ── Progress store ─────────────────────────────────────────────

interface ProgressStore {
  progress: Progress;
  startTime: number | null;
  setProgress: (p: Progress) => void;
  setStartTime: (t: number) => void;
  reset: () => void;
}

const initialProgress: Progress = {
  stage: "",
  current: 0,
  total: 0,
  pct: 0,
  current_file: "",
  stages: {},
};

export const useProgressStore = create<ProgressStore>((set) => ({
  progress: { ...initialProgress },
  startTime: null,

  setProgress: (progress) => set({ progress }),
  setStartTime: (startTime) => set({ startTime }),
  reset: () => set({ progress: { ...initialProgress }, startTime: null }),
}));
