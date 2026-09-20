import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { useSessionStore } from "@/lib/stores";
import { api } from "@/lib/api";
import { Landing } from "@/components/Landing";
import { Onboarding } from "@/components/Onboarding";
import { Processing } from "@/components/Processing";
import { Review } from "@/components/Review";
import { Export } from "@/components/Export";
import { Workflow } from "@/components/Workflow";
import { Titlebar } from "@/components/Titlebar";
import { UsageNotice } from "@/components/UsageNotice";
import { hasAcceptedNotice } from "@/lib/use-notice";
import { UpdatePopup } from "@/components/UpdatePopup";
import { invoke } from "@tauri-apps/api/core";
import { useLocale } from "@/lib/i18n";

const DEV_FALLBACK_PORT = 9470;
// The PyInstaller onefile sidecar can take a while to cold-start (it unpacks
// ~170MB and imports OpenCV/scikit-image each launch), so wait generously
// before giving up — we connect the instant the port is available anyway.
const BACKEND_CONNECT_TIMEOUT_MS = 120000;
const BACKEND_POLL_INTERVAL_MS = 250;

type BackendStatus = "connecting" | "ready" | "error";

function BackendGate({
  status,
  onRetry,
}: {
  status: BackendStatus;
  onRetry: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      {status === "connecting" ? (
        <>
          <div className="size-8 animate-spin rounded-full border-2 border-foreground/20 border-t-amber-400" />
          <p className="text-sm text-muted-foreground">
            {t("backend.connecting")}
          </p>
        </>
      ) : (
        <>
          <div className="flex size-12 items-center justify-center rounded-full bg-red-500/15">
            <svg
              className="size-6 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">
              {t("backend.errorTitle")}
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("backend.errorHint")}
            </p>
          </div>
          <button
            onClick={onRetry}
            className="rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-2 text-sm font-semibold text-black transition-opacity hover:from-amber-400 hover:to-yellow-400"
          >
            {t("backend.retry")}
          </button>
        </>
      )}
    </div>
  );
}

function App() {
  const { screen, setBackendPort } = useSessionStore();
  const [backendStatus, setBackendStatus] =
    useState<BackendStatus>("connecting");
  const [attempt, setAttempt] = useState(0);
  const [accepted, setAccepted] = useState(hasAcceptedNotice);
  const [viewNotice, setViewNotice] = useState(false);
  const noticeOpen = !accepted || viewNotice;
  const noticeTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!viewNotice && noticeTrigger.current) {
      noticeTrigger.current.focus();
      noticeTrigger.current = null;
    }
  }, [viewNotice]);

  useEffect(() => {
    let cancelled = false;
    setBackendStatus("connecting");

    // Outside Tauri (browser `vite dev`) the sidecar isn't managed for us, so
    // fall back to the well-known dev port instead of polling a command that
    // will never resolve.
    const inTauri = "__TAURI_INTERNALS__" in window;
    if (!inTauri) {
      api.setPort(DEV_FALLBACK_PORT);
      setBackendPort(DEV_FALLBACK_PORT);
      setBackendStatus("ready");
      return;
    }

    async function connect() {
      const deadline = Date.now() + BACKEND_CONNECT_TIMEOUT_MS;
      while (!cancelled && Date.now() < deadline) {
        try {
          // Rust returns "Backend not ready" until the sidecar prints its port.
          const port = await invoke<number>("get_backend_port");
          if (cancelled) return;
          api.setPort(port);
          setBackendPort(port);
          setBackendStatus("ready");
          return;
        } catch {
          await new Promise((r) => setTimeout(r, BACKEND_POLL_INTERVAL_MS));
        }
      }
      if (!cancelled) setBackendStatus("error");
    }

    connect();
    return () => {
      cancelled = true;
    };
  }, [setBackendPort, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return (
    <>
      <div
        inert={noticeOpen}
        aria-hidden={noticeOpen}
        className="h-screen w-screen flex flex-col overflow-hidden bg-background rounded-[10px]"
      >
        <Titlebar
          onOpenNotice={() => {
            noticeTrigger.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
            setViewNotice(true);
          }}
        />
        {accepted && backendStatus === "ready" && (
          <UpdatePopup blocked={noticeOpen} />
        )}
        {accepted && backendStatus === "ready" && <Onboarding />}
        {/* pt matches the fixed 38px titlebar so screen content never hides under it */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden pt-[38px]">
          {!accepted ? null : backendStatus !== "ready" ? (
            <BackendGate status={backendStatus} onRetry={retry} />
          ) : (
            <>
              <Workflow />
              <div className="min-h-0 flex-1 overflow-hidden">
                {screen === "landing" && <Landing />}
                {screen === "processing" && <Processing />}
                {screen === "review" && <Review />}
                {screen === "export" && <Export />}
              </div>
            </>
          )}
        </main>
      </div>
      {noticeOpen && (
        <UsageNotice
          required={!accepted}
          onAccepted={() => {
            setAccepted(true);
            setViewNotice(false);
          }}
          onClose={() => setViewNotice(false)}
        />
      )}
    </>
  );
}

export default App;
