import { api } from "./api";
import { usePhotosStore, categoryOf } from "./stores";
import { t } from "./i18n";

/**
 * Optimistically move photos to a destination: the grid and summary update
 * immediately, the API call runs in the background, and a failure rolls the
 * change back (with a toast) so the UI never lies about saved state.
 */
export async function triage(ids: string[], destination: string): Promise<void> {
  if (ids.length === 0) return;
  const store = usePhotosStore.getState();

  const idSet = new Set(ids);
  const previous = new Map<string, string>();
  for (const p of store.photos) {
    if (idSet.has(p.id)) previous.set(p.id, p.destination);
  }
  if (previous.size === 0) return;

  const delta = { keep: 0, maybe: 0, reject: 0 };
  for (const dest of previous.values()) delta[categoryOf(dest)]--;
  delta[categoryOf(destination)] += previous.size;

  usePhotosStore.setState((s) => ({
    photos: s.photos.map((p) =>
      previous.has(p.id) ? { ...p, destination } : p
    ),
  }));
  store.adjustSummary(delta);

  try {
    if (ids.length === 1) {
      await api.setOverride(ids[0], destination);
    } else {
      await api.setBatchOverride(ids, destination);
    }
    api.getHistory().then((h) => usePhotosStore.getState().setHistory(h)).catch(() => {});
  } catch (e) {
    console.error("Triage failed, rolling back:", e);
    usePhotosStore.setState((s) => ({
      photos: s.photos.map((p) =>
        previous.has(p.id) ? { ...p, destination: previous.get(p.id)! } : p
      ),
    }));
    api.getSummary().then((sum) => usePhotosStore.getState().setSummary(sum)).catch(() => {});
    const setToast = usePhotosStore.getState().setToast;
    setToast(t("triage.failed"));
    setTimeout(() => usePhotosStore.getState().setToast(null), 4000);
  }
}
