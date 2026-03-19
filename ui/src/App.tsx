import { useEffect, useState } from "react";
import "./App.css";
import { useSessionStore } from "@/lib/stores";
import { api } from "@/lib/api";
import { Landing } from "@/components/Landing";
import { Processing } from "@/components/Processing";
import { Review } from "@/components/Review";
import { Export } from "@/components/Export";
import { Titlebar } from "@/components/Titlebar";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useLocale } from "@/lib/i18n";

function UpdatePopup() {
  const [update, setUpdate] = useState<{ version: string; body: string } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    check().then((u) => {
      if (u) setUpdate({ version: u.version, body: u.body ?? "" });
    }).catch(() => {});
  }, []);

  if (!update || dismissed) return null;

  async function handleUpdate() {
    setInstalling(true);
    try {
      const u = await check();
      if (!u) return;
      let downloaded = 0;
      let contentLength = 0;
      await u.downloadAndInstall((e) => {
        if (e.event === "Started") {
          contentLength = (e.data as { contentLength?: number }).contentLength || 0;
          downloaded = 0;
        } else if (e.event === "Progress") {
          downloaded += (e.data as { chunkLength: number }).chunkLength;
          if (contentLength > 0) setProgress(Math.round((downloaded / contentLength) * 100));
        }
      });
      await relaunch();
    } catch {
      setInstalling(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass mx-4 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-white/10">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
            <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-foreground">{t("update.available")}</h2>
          <p className="mt-1 text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
            v{update.version}
          </p>
        </div>

        {installing ? (
          <div className="space-y-2">
            <p className="text-center text-sm text-muted-foreground">{t("update.downloading")}</p>
            <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-xs text-muted-foreground tabular-nums">{progress}%</p>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => setDismissed(true)}
              className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/5"
            >
              {t("update.later")}
            </button>
            <button
              onClick={handleUpdate}
              className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:from-amber-400 hover:to-yellow-400"
            >
              {t("update.install")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const { screen, backendPort } = useSessionStore();

  useEffect(() => {
    const devPort = 9470;
    api.setPort(backendPort ?? devPort);
  }, [backendPort]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background rounded-[10px]">
      <Titlebar />
      <UpdatePopup />
      <main className="flex-1 overflow-hidden">
        {screen === "landing" && <Landing />}
        {screen === "processing" && <Processing />}
        {screen === "review" && <Review />}
        {screen === "export" && <Export />}
      </main>
    </div>
  );
}

export default App;
