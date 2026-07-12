import { useCallback, useEffect, useState } from "react";
import { Check, Columns2, Layers, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePhotosStore } from "@/lib/stores";
import { useLocale } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { Photo, PhotoGroup } from "@/lib/api";

// ─── Category badge helper ───────────────────────────────────

function destStyle(destination: string): { color: string; tKey: "review.keep" | "review.maybe" | "review.reject" } {
  if (destination === "keep") return { color: "bg-green-500/15 text-green-400", tKey: "review.keep" };
  if (destination === "maybe") return { color: "bg-amber-500/15 text-amber-400", tKey: "review.maybe" };
  return { color: "bg-red-500/15 text-red-400", tKey: "review.reject" };
}

// ─── Group Panel ─────────────────────────────────────────────

export function GroupPanel() {
  const { activeGroupId, setActiveGroupId, setComparePhotos, setSummary, updatePhotoDestination } =
    usePhotosStore();
  const { t } = useLocale();
  const [group, setGroup] = useState<PhotoGroup | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch the group whenever the active id changes.
  useEffect(() => {
    let cancelled = false;
    if (!activeGroupId) {
      setGroup(null);
      setSelectedId(null);
      return;
    }
    api
      .getGroup(activeGroupId)
      .then((g) => {
        if (cancelled) return;
        setGroup(g);
        setSelectedId(g.best);
      })
      .catch((e) => {
        console.error("Failed to load group:", e);
        if (!cancelled) setActiveGroupId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeGroupId, setActiveGroupId]);

  const close = useCallback(() => setActiveGroupId(null), [setActiveGroupId]);

  // Escape closes the panel.
  useEffect(() => {
    if (!activeGroupId) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [activeGroupId, close]);

  const refreshMemberDestinations = useCallback(async () => {
    if (!group) return;
    const summaryRes = await api.getSummary();
    setSummary(summaryRes);
    // Re-fetch group members so their destination badges reflect the change.
    const updated = await api.getGroup(group.id);
    setGroup(updated);
  }, [group, setSummary]);

  async function handleMemberOverride(photoId: string, dest: string) {
    try {
      await api.setOverride(photoId, dest);
      updatePhotoDestination(photoId, dest);
      await refreshMemberDestinations();
    } catch (e) {
      console.error("Failed to override:", e);
    }
  }

  async function handleKeepThisRejectRest() {
    if (!group || !selectedId) return;
    const rejectIds = group.members
      .map((m) => m.id)
      .filter((id) => id !== selectedId);
    try {
      await api.setOverride(selectedId, "keep");
      updatePhotoDestination(selectedId, "keep");
      if (rejectIds.length > 0) {
        await api.setBatchOverride(rejectIds, "reject");
        for (const id of rejectIds) updatePhotoDestination(id, "reject");
      }
      await refreshMemberDestinations();
    } catch (e) {
      console.error("Failed to apply keep-this-reject-rest:", e);
    }
  }

  if (!activeGroupId || !group) return null;

  const selected: Photo | undefined =
    group.members.find((m) => m.id === selectedId) ?? group.members[0];
  const kindLabel =
    group.kind === "duplicate" ? t("group.kind_duplicate") : t("group.kind_similar");

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="glass flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
          <Layers className="size-4 text-amber-400" />
          <h3 className="text-sm font-semibold">{t("group.title")}</h3>
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs text-muted-foreground">
            {kindLabel}
          </span>
          <span className="text-xs text-white/30">
            {t("group.members", { n: group.members.length })}
          </span>
          <button
            onClick={close}
            className="ml-auto rounded p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Large preview */}
        {selected && (
          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/40 p-4">
            <img
              key={selected.id}
              src={api.fullUrl(selected.id)}
              alt={selected.filename}
              className="max-h-[46vh] max-w-full object-contain drop-shadow-2xl"
            />
            {selected.is_group_best && (
              <span className="absolute left-6 top-6 flex items-center gap-1 rounded-md bg-amber-500/90 px-2 py-1 text-xs font-semibold text-black">
                <Star className="size-3" />
                {t("group.auto_pick")}
              </span>
            )}
          </div>
        )}

        {/* Member strip */}
        <div className="flex gap-3 overflow-x-auto border-t border-white/10 px-4 py-3">
          {group.members.map((m) => {
            const ds = destStyle(m.destination);
            const isActive = m.id === selectedId;
            const score = m.quality_score ?? 0;
            return (
              <div
                key={m.id}
                className={cn(
                  "relative w-32 shrink-0 cursor-pointer overflow-hidden rounded-lg border transition-all",
                  isActive
                    ? "border-amber-400 ring-2 ring-amber-400/40"
                    : "border-white/10 hover:border-white/25"
                )}
                onClick={() => setSelectedId(m.id)}
              >
                <div className="relative aspect-[4/3] w-full bg-foreground/5">
                  <img
                    src={api.thumbnailUrl(m.id)}
                    alt={m.filename}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {m.is_group_best && (
                    <span className="absolute left-1 top-1 rounded bg-amber-500/90 px-1 py-0.5 text-[10px] font-semibold text-black">
                      <Star className="size-2.5" />
                    </span>
                  )}
                  <span className="absolute right-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                    {Math.round(score)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-1.5 py-1">
                  <span
                    className={cn(
                      "rounded px-1 py-0.5 text-[10px] font-medium",
                      ds.color
                    )}
                  >
                    {t(ds.tKey)}
                  </span>
                </div>
                {/* Per-member K/M/R */}
                <div className="flex gap-0.5 px-1.5 pb-1.5">
                  <button
                    className="flex-1 rounded bg-green-500/15 py-1 text-green-400 transition-colors hover:bg-green-500/25"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMemberOverride(m.id, "keep");
                    }}
                    title={t("review.moveToKeep")}
                  >
                    <Check className="mx-auto size-3" />
                  </button>
                  <button
                    className="flex-1 rounded bg-amber-500/15 py-1 text-amber-400 transition-colors hover:bg-amber-500/25"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMemberOverride(m.id, "maybe");
                    }}
                    title={t("review.moveToMaybe")}
                  >
                    <Star className="mx-auto size-3" />
                  </button>
                  <button
                    className="flex-1 rounded bg-red-500/15 py-1 text-red-400 transition-colors hover:bg-red-500/25"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMemberOverride(m.id, "reject");
                    }}
                    title={t("review.moveToReject")}
                  >
                    <Trash2 className="mx-auto size-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 border-t border-white/10 px-5 py-3">
          {group.members.length >= 2 && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                // Compare the top members (already score-descending), max 4.
                setComparePhotos(group.members.slice(0, 4));
                setActiveGroupId(null);
              }}
            >
              <Columns2 className="size-4" />
              {t("group.compare")}
            </Button>
          )}
          <Button
            className="flex-1 gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 font-semibold text-black hover:from-amber-400 hover:to-yellow-400"
            onClick={handleKeepThisRejectRest}
            disabled={!selectedId}
          >
            <Check className="size-4" />
            {t("group.keep_this_reject_rest")}
          </Button>
        </div>
      </div>
    </div>
  );
}
