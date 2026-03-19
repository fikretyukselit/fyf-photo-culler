import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import { FolderOpen, X, Play, FolderOutput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/lib/stores";
import { useLocale } from "@/lib/i18n";
import { api } from "@/lib/api";
import fyfIcon from "@/assets/orta.png";

export function Landing() {
  const {
    inputFolders,
    addFolder,
    removeFolder,
    mergeMode,
    setMergeMode,
    outputDir,
    setOutputDir,
    setScreen,
  } = useSessionStore();

  const { t } = useLocale();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  async function handleSelectFolders() {
    const selected = await open({
      directory: true,
      multiple: true,
      title: "Select photo folders",
    });
    if (selected) {
      const folders = Array.isArray(selected) ? selected : [selected];
      for (const f of folders) {
        if (!inputFolders.includes(f)) addFolder(f);
      }
    }
  }

  async function handleSelectOutput() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select output folder",
    });
    if (selected) {
      const dir = Array.isArray(selected) ? selected[0] : selected;
      setOutputDir(dir);
    }
  }

  async function handleStart() {
    if (inputFolders.length === 0) return;
    setStarting(true);
    setError(null);
    try {
      const check = await api.checkFolders(inputFolders);
      
      if (check.jpg_count === 0) {
        setError(t("landing.noJpgFound"));
        setStarting(false);
        return;
      }
      
      if (check.other_count > 0) {
        const proceed = window.confirm(t("landing.onlyJpgSupported"));
        if (!proceed) {
          setStarting(false);
          return;
        }
      }

      await api.analyze(inputFolders, mergeMode, outputDir);
      setScreen("processing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start analysis");
      setStarting(false);
    }
  }

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      {/* Animated gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-blob-1 absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-purple-700/20 blur-[120px]" />
        <div className="animate-blob-2 absolute -right-32 -bottom-32 h-[500px] w-[500px] rounded-full bg-blue-700/20 blur-[120px]" />
        <div className="animate-blob-3 absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-600/10 blur-[120px]" />
      </div>

      {/* Glass card */}
      <div className="glass relative z-10 mx-4 w-full max-w-lg rounded-2xl p-8">
        {/* Logo & Title */}
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={fyfIcon}
            alt="FYF"
            className="mb-4 h-20 w-auto object-contain"
          />
          <h1 className="mb-1 text-3xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
              FYF
            </span>{" "}
            Photo Culler
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("app.subtitle")}
          </p>
          {appVersion && (
            <span className="mt-1 text-[11px] text-muted-foreground/50">
              v{appVersion}
            </span>
          )}
        </div>

        {/* Select folders */}
        <Button
          variant="outline"
          className="mb-4 w-full gap-2"
          onClick={handleSelectFolders}
        >
          <FolderOpen className="size-4" />
          {t("landing.selectFolders")}
        </Button>

        {/* Folder list */}
        {inputFolders.length > 0 && (
          <div className="mb-4 max-h-40 space-y-1.5 overflow-y-auto">
            {inputFolders.map((folder, idx) => (
              <div
                key={folder}
                className="flex items-center gap-2 rounded-lg bg-foreground/5 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-foreground/70">
                  {folder}
                </span>
                <button
                  onClick={() => removeFolder(idx)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground/80"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Merge mode */}
        <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-lg bg-foreground/5 px-3 py-2.5">
          <input
            type="checkbox"
            checked={mergeMode}
            onChange={(e) => setMergeMode(e.target.checked)}
            className="size-4 rounded accent-amber-500"
          />
          <span className="text-sm text-foreground/70">
            {t("landing.mergeMode")}
          </span>
        </label>

        {/* Output folder */}
        <Button
          variant="outline"
          className="mb-6 w-full gap-2"
          onClick={handleSelectOutput}
        >
          <FolderOutput className="size-4" />
          {outputDir ? (
            <span className="truncate">{outputDir}</span>
          ) : (
            t("landing.selectOutput")
          )}
        </Button>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Start button */}
        <Button
          className={cn(
            "w-full gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-sm font-semibold text-black transition-opacity hover:from-amber-400 hover:to-yellow-400",
            starting && "animate-pulse"
          )}
          disabled={inputFolders.length === 0 || starting}
          onClick={handleStart}
        >
          <Play className="size-4" />
          {starting ? t("landing.starting") : t("landing.startCulling")}
        </Button>
      </div>

      {/* Blob animation keyframes */}
      <style>{`
        @keyframes blob1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(60px, -40px) scale(1.1); }
          66% { transform: translate(-30px, 30px) scale(0.95); }
        }
        @keyframes blob2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-50px, 30px) scale(0.95); }
          66% { transform: translate(40px, -20px) scale(1.08); }
        }
        @keyframes blob3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          33% { transform: translate(-50%, -50%) scale(1.15); }
          66% { transform: translate(-50%, -50%) scale(0.9); }
        }
        .animate-blob-1 { animation: blob1 20s ease-in-out infinite; }
        .animate-blob-2 { animation: blob2 25s ease-in-out infinite; }
        .animate-blob-3 { animation: blob3 22s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
