import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, FolderOpen, Play, Star, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/lib/stores";
import { useLocale } from "@/lib/i18n";

const SCENE_MS = 3600;
const SCENES = 4;

/** Scene 1 — SD cards slide in, the Start pill pulses. */
function SceneCards() {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-end gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="ob-rise relative"
            style={{ animationDelay: `${i * 260}ms` }}
          >
            {/* SD card silhouette: clipped corner + gold contacts */}
            <div
              className="relative h-20 w-14 rounded-md border border-foreground/20 bg-foreground/10"
              style={{ clipPath: "polygon(0 0, 72% 0, 100% 18%, 100% 100%, 0 100%)" }}
            >
              <div className="absolute left-1.5 top-1.5 flex gap-0.5">
                {[0, 1, 2, 3].map((c) => (
                  <span key={c} className="h-2.5 w-1 rounded-sm bg-amber-400/70" />
                ))}
              </div>
              <div className="absolute inset-x-1.5 bottom-1.5 h-6 rounded-sm bg-foreground/10" />
            </div>
          </div>
        ))}
      </div>
      <div
        className="ob-rise ob-pulse-gold flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-1.5 text-xs font-semibold text-black"
        style={{ animationDelay: "900ms, 1200ms" }}
      >
        <Play className="size-3" />
        <span className="h-2 w-14 rounded-full bg-black/25" />
      </div>
    </div>
  );
}

/** Scene 2 — a grid of shimmering tiles gets scored one by one. */
function SceneScores() {
  const dots = ["bg-keep", "bg-keep", "bg-maybe", "bg-keep", "bg-reject", "bg-keep", "bg-maybe", "bg-keep"];
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {dots.map((dot, i) => (
        <div key={i} className="ob-rise relative" style={{ animationDelay: `${i * 110}ms` }}>
          <div
            className={cn(
              "ob-shimmer h-14 w-[74px] rounded-lg border border-foreground/10",
              i === 1 && "ring-2 ring-amber-400"
            )}
            style={{ animationDelay: `${i * 110}ms` }}
          />
          <span
            className="ob-pop absolute right-1 top-1 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5"
            style={{ animationDelay: `${700 + i * 140}ms` }}
          >
            <span className={cn("size-1.5 rounded-full", dot)} />
            {i === 1 && <span className="text-[9px] font-bold tabular-nums text-white">97</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Scene 3 — the culling loop: photo slides in, K presses, photo flies off. */
function SceneKeys() {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-[120px] w-[190px]">
        <div className="ob-cull-photo absolute inset-0 rounded-xl border-2 border-keep/0 bg-foreground/10">
          <div className="ob-shimmer h-full w-full rounded-[10px]" />
          <span className="ob-cull-check absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-keep text-black">
            <Check className="size-3.5" />
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <kbd className="ob-key-press flex h-9 w-9 items-center justify-center rounded-lg border border-keep/60 bg-keep/15 text-sm font-bold text-keep">
          K
        </kbd>
        <kbd className="flex h-9 w-9 items-center justify-center rounded-lg border border-foreground/15 bg-foreground/5 text-sm font-bold text-muted-foreground">
          M
        </kbd>
        <kbd className="flex h-9 w-9 items-center justify-center rounded-lg border border-foreground/15 bg-foreground/5 text-sm font-bold text-muted-foreground">
          R
        </kbd>
      </div>
    </div>
  );
}

/** Scene 4 — cards drop into keep/maybe/reject stacks, folder pops. */
function SceneExport() {
  const cols = [
    { icon: Check, color: "text-keep", bg: "bg-keep/15", n: 3 },
    { icon: Star, color: "text-maybe", bg: "bg-maybe/15", n: 2 },
    { icon: Trash2, color: "text-reject", bg: "bg-reject/15", n: 1 },
  ];
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-start gap-5">
        {cols.map((col, ci) => (
          <div key={ci} className="flex w-16 flex-col items-center gap-1.5">
            <span className={cn("ob-rise flex size-6 items-center justify-center rounded-full", col.bg, col.color)}>
              <col.icon className="size-3.5" />
            </span>
            {Array.from({ length: col.n }).map((_, i) => (
              <div
                key={i}
                className="ob-drop ob-shimmer h-8 w-full rounded-md border border-foreground/10"
                style={{ animationDelay: `${300 + ci * 220 + i * 180}ms, 0ms` }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="ob-pop flex items-center gap-2 text-amber-400" style={{ animationDelay: "1500ms" }}>
        <FolderOpen className="size-4" />
        <Check className="size-3.5" />
      </div>
    </div>
  );
}

const SCENE_VIEWS = [SceneCards, SceneScores, SceneKeys, SceneExport];
const SCENE_KEYS = [
  { title: "onboarding.s1.title", caption: "onboarding.s1.caption" },
  { title: "onboarding.s2.title", caption: "onboarding.s2.caption" },
  { title: "onboarding.s3.title", caption: "onboarding.s3.caption" },
  { title: "onboarding.s4.title", caption: "onboarding.s4.caption" },
] as const;

/**
 * First-launch tour: the culling workflow acted out by skeleton UI in four
 * auto-advancing scenes. Shown once (localStorage), replayable from Landing.
 */
export function Onboarding() {
  const { onboardingOpen, setOnboardingOpen, screen } = useSessionStore();
  const { t } = useLocale();
  const [scene, setScene] = useState(0);

  const close = useCallback(() => {
    setOnboardingOpen(false);
    setScene(0);
  }, [setOnboardingOpen]);

  const open = onboardingOpen && screen === "landing";

  // Auto-advance; the last scene waits for the user.
  useEffect(() => {
    if (!open || scene >= SCENES - 1) return;
    const id = setTimeout(() => setScene((s) => Math.min(s + 1, SCENES - 1)), SCENE_MS);
    return () => clearTimeout(id);
  }, [open, scene]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (scene >= SCENES - 1) close();
        else setScene((s) => s + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setScene((s) => Math.max(s - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, scene, close]);

  if (!open) return null;

  const Scene = SCENE_VIEWS[scene];
  const last = scene === SCENES - 1;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-md">
      <div className="mx-4 w-full max-w-[520px] rounded-2xl border border-border bg-popover p-6 shadow-2xl shadow-black/50">
        {/* Header: wordmark left, skip right — its own row so nothing overlaps the stage */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400/80">
            FYF Photo Culler
          </span>
          <button
            onClick={close}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            {t("onboarding.skip")}
            <X className="size-3.5" />
          </button>
        </div>

        {/* Stage — remount per scene so animations restart */}
        <div
          key={scene}
          className="flex h-[240px] items-center justify-center overflow-hidden rounded-xl border border-border bg-background/70"
        >
          <Scene />
        </div>

        {/* Copy */}
        <div key={`copy-${scene}`} className="mt-5 min-h-[64px] text-center">
          <h2 className="ob-rise text-lg font-semibold">{t(SCENE_KEYS[scene].title)}</h2>
          <p className="ob-rise mt-1 text-sm text-muted-foreground" style={{ animationDelay: "120ms" }}>
            {t(SCENE_KEYS[scene].caption)}
          </p>
        </div>

        {/* Controls */}
        <div className="mt-4 flex items-center">
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: SCENES }).map((_, i) => (
              <button
                key={i}
                onClick={() => setScene(i)}
                aria-label={`Scene ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === scene ? "w-6 bg-amber-400" : "w-1.5 bg-foreground/20 hover:bg-foreground/40"
                )}
              />
            ))}
          </div>
          <button
            onClick={() => (last ? close() : setScene((s) => s + 1))}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
              last
                ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:from-amber-400 hover:to-yellow-400"
                : "bg-foreground/10 text-foreground hover:bg-foreground/15"
            )}
          >
            {last ? t("onboarding.start") : t("onboarding.next")}
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes ob-rise {
          from { opacity: 0; transform: translateY(14px) scale(0.96); }
          to { opacity: 1; transform: none; }
        }
        @keyframes ob-shimmer-kf {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        @keyframes ob-pop {
          0% { opacity: 0; transform: scale(0.3); }
          70% { opacity: 1; transform: scale(1.18); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes ob-drop {
          from { opacity: 0; transform: translateY(-22px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes ob-pulse-gold-kf {
          0%, 100% { box-shadow: 0 0 0 0 rgba(253, 190, 64, 0.45); }
          50% { box-shadow: 0 0 0 10px rgba(253, 190, 64, 0); }
        }
        /* One 4s culling cycle: slide in → hold → K press → fly off kept */
        @keyframes ob-cull-photo-kf {
          0% { opacity: 0; transform: translateX(-36px) scale(0.94); border-color: transparent; }
          12% { opacity: 1; transform: none; border-color: transparent; }
          52% { transform: none; border-color: transparent; }
          60% { border-color: var(--color-keep); }
          62% { opacity: 1; transform: translateX(0); }
          82% { opacity: 0; transform: translateX(90px) rotate(3deg) scale(0.9); border-color: var(--color-keep); }
          100% { opacity: 0; transform: translateX(90px); }
        }
        @keyframes ob-cull-check-kf {
          0%, 55% { opacity: 0; transform: scale(0.3); }
          62% { opacity: 1; transform: scale(1.2); }
          68%, 82% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; }
        }
        @keyframes ob-key-press-kf {
          0%, 52%, 66%, 100% { transform: none; box-shadow: none; }
          57% { transform: translateY(2px) scale(0.92); box-shadow: 0 0 14px 0 var(--color-keep); }
        }
        .ob-rise { animation: ob-rise 0.55s cubic-bezier(0.2, 0.9, 0.25, 1.2) both; }
        .ob-pop { animation: ob-pop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.4) both; }
        .ob-drop { animation: ob-drop 0.5s cubic-bezier(0.2, 0.9, 0.25, 1.2) both, ob-shimmer-kf 2.2s linear infinite; }
        .ob-shimmer {
          background: linear-gradient(100deg, oklch(1 0 0 / 5%) 40%, oklch(1 0 0 / 14%) 50%, oklch(1 0 0 / 5%) 60%);
          background-size: 200% 100%;
          animation: ob-shimmer-kf 2.2s linear infinite;
        }
        .ob-rise.ob-shimmer { animation: ob-rise 0.55s cubic-bezier(0.2,0.9,0.25,1.2) both, ob-shimmer-kf 2.2s linear infinite; }
        .ob-pulse-gold { animation: ob-rise 0.55s cubic-bezier(0.2,0.9,0.25,1.2) both, ob-pulse-gold-kf 1.8s ease-out infinite; }
        .ob-cull-photo { animation: ob-cull-photo-kf 4s ease-in-out infinite; }
        .ob-cull-check { animation: ob-cull-check-kf 4s ease-in-out infinite; }
        .ob-key-press { animation: ob-key-press-kf 4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ob-rise, .ob-pop, .ob-drop, .ob-shimmer, .ob-pulse-gold,
          .ob-cull-photo, .ob-cull-check, .ob-key-press { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
}
