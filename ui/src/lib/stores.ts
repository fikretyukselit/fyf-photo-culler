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

interface PhotosStore {
  photos: Photo[];
  activeCategory: string;
  selectedIds: Set<string>;
  detailPhoto: Photo | null;
  summary: Summary;
  sortBy: SortBy;
  setPhotos: (photos: Photo[]) => void;
  setActiveCategory: (cat: string) => void;
  toggleSelect: (id: string) => void;
  selectRange: (startId: string, endId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setDetailPhoto: (photo: Photo | null) => void;
  setSummary: (summary: Summary) => void;
  setSortBy: (sort: SortBy) => void;
  updatePhotoDestination: (id: string, destination: string) => void;
}

export const usePhotosStore = create<PhotosStore>((set) => ({
  photos: [],
  activeCategory: "all",
  selectedIds: new Set<string>(),
  detailPhoto: null,
  summary: { keep: 0, maybe: 0, reject: 0, total: 0 },
  sortBy: "quality_score",

  setPhotos: (photos) => set({ photos }),

  setActiveCategory: (activeCategory) =>
    set({ activeCategory, selectedIds: new Set() }),

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
        activeCategory === "all"
          ? photos
          : photos.filter((p) => p.destination === activeCategory);

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
        activeCategory === "all"
          ? photos
          : photos.filter((p) => p.destination === activeCategory);
      return { selectedIds: new Set(filtered.map((p) => p.id)) };
    }),

  clearSelection: () => set({ selectedIds: new Set() }),

  setDetailPhoto: (detailPhoto) => set({ detailPhoto }),

  setSummary: (summary) => set({ summary }),

  setSortBy: (sortBy) => set({ sortBy }),

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
