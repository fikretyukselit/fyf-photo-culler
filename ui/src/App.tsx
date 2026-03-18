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

function UpdateBanner() {
  const [update, setUpdate] = useState<{ version: string; body: string } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const { t } = useLocale();

  useEffect(() => {
    check().then((u) => {
      if (u) setUpdate({ version: u.version, body: u.body ?? "" });
    }).catch(() => {});
  }, []);

  if (!update) return null;

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
    <div className="flex items-center gap-3 bg-amber-500/15 border-b border-amber-500/20 px-4 py-2 text-sm">
      <span className="flex-1 text-amber-300">
        {t("update.available")} <strong>v{update.version}</strong>
      </span>
      {installing ? (
        <span className="text-amber-400 tabular-nums">{progress}%</span>
      ) : (
        <button
          onClick={handleUpdate}
          className="rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-400"
        >
          {t("update.install")}
        </button>
      )}
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
      <UpdateBanner />
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
