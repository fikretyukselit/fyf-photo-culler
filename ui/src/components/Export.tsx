import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FolderOpen,
  FolderOutput,
  ShieldCheck,
  Star,
  X,
  Loader2,
  CircleCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionStore, categoryOf } from "@/lib/stores";
import { useLocale } from "@/lib/i18n";
import { api } from "@/lib/api";

type ExportState = "idle" | "exporting" | "complete" | "error";

export function Export() {
  const { setScreen } = useSessionStore();
  const { t } = useLocale();
  const [preview, setPreview] = useState<Record<string, number> | null>(null);
  const [state, setState] = useState<ExportState>("idle");
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [exportedDir, setExportedDir] = useState<string | null>(null);
  const [sessionOutput, setSessionOutput] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const previewGeneration = useRef(0);

  const loadPreview = useCallback(async () => {
    const generation = ++previewGeneration.current;
    setPreviewError(false);
    setPreview(null);
    try {
      const [counts, session] = await Promise.all([
        api.getExportPreview(),
        api.getSession(),
      ]);
      if (generation !== previewGeneration.current) return;
      setPreview(counts);
      setSessionOutput(session.output_dir ?? null);
    } catch {
      if (generation === previewGeneration.current) setPreviewError(true);
    }
  }, []);
  useEffect(() => {
    loadPreview();
    return () => {
      previewGeneration.current++;
    };
  }, [loadPreview]);
  useEffect(() => () => esRef.current?.close(), []);

  function handleExport() {
    if (esRef.current || !preview) return;
    setState("exporting");
    setProgress(0);
    setError(null);
    const es = api.exportStream();
    esRef.current = es;
    function stop() {
      es.close();
      esRef.current = null;
    }
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.pct != null) setProgress(Math.max(0, Math.min(100, data.pct)));
        if (data.current_file) setCurrentFile(data.current_file);
        if (data.stage === "complete") {
          stop();
          setExportedDir(data.output_dir ?? null);
          setState("complete");
        } else if (data.stage === "error") {
          stop();
          setState("error");
          setError(data.message || data.current_file || t("export.error"));
        }
      } catch {
        stop();
        setState("error");
        setError(t("export.error"));
      }
    };
    es.onerror = () => {
      stop();
      setState("error");
      setError(t("export.connectionLost"));
    };
  }

  async function handleOpenFolder() {
    const dir = exportedDir || sessionOutput;
    if (!dir) return;
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(dir);
    } catch {
      setError(t("export.openError"));
    }
  }

  const counts = { keep: 0, maybe: 0, reject: 0 };
  for (const [destination, count] of Object.entries(preview ?? {}))
    counts[categoryOf(destination)] += count;
  const total = counts.keep + counts.maybe + counts.reject;
  const categories = [
    {
      key: "keep",
      label: "review.keep",
      icon: Check,
      className: "text-green-400",
    },
    {
      key: "maybe",
      label: "review.maybe",
      icon: Star,
      className: "text-amber-400",
    },
    {
      key: "reject",
      label: "review.reject",
      icon: X,
      className: "text-red-400",
    },
  ] as const;

  return (
    <div className="stage-page">
      <section className="stage-card" aria-labelledby="export-title">
        <div className="section-icon mb-5">
          {state === "complete" ? (
            <CircleCheck className="text-green-400" size={23} />
          ) : (
            <FolderOutput size={23} />
          )}
        </div>
        <h1 id="export-title">
          {t(
            state === "complete"
              ? "export.complete"
              : state === "error"
                ? "export.error"
                : "export.title",
          )}
        </h1>
        <p className="stage-description">
          {t(
            state === "complete" ? "export.completeDesc" : "export.description",
          )}
        </p>
        {previewError ? (
          <div className="inline-error" role="alert">
            <p>{t("export.previewError")}</p>
            <Button variant="outline" className="mt-3" onClick={loadPreview}>
              {t("review.retry")}
            </Button>
          </div>
        ) : !preview ? (
          <p
            role="status"
            className="my-8 flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 size={16} className="animate-spin" />
            {t("export.loading")}
          </p>
        ) : (
          <>
            <div className="export-categories">
              {categories.map(({ key, label, icon: Icon, className }) => (
                <div key={key} className="export-category">
                  <Icon size={17} className={className} />
                  <span>{t(label)}</span>
                  <strong className={className}>
                    {counts[key].toLocaleString()}
                  </strong>
                </div>
              ))}
            </div>
            <p className="mb-5 text-sm font-medium">
              {t("export.total", { n: total })}
            </p>
          </>
        )}
        <div className="export-path">
          <span>{t("export.outputFolder")}</span>
          <p>{exportedDir || sessionOutput || t("export.defaultHint")}</p>
        </div>
        <p className="copy-note">
          <ShieldCheck size={16} />
          {t("export.copyNote")}
        </p>
        {state === "exporting" && (
          <div className="mb-6" role="status">
            <div className="mb-3 flex justify-between text-sm">
              <span>{t("export.exporting")}</span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label={t("export.exporting")}
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 truncate text-xs text-muted-foreground">
              {currentFile}
            </p>
          </div>
        )}
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        <div className="stage-actions">
          <Button
            variant="outline"
            disabled={state === "exporting"}
            onClick={() => setScreen("review")}
          >
            <ArrowLeft size={16} />
            {t("export.backToReview")}
          </Button>
          {state === "complete" ? (
            <Button
              disabled={!exportedDir && !sessionOutput}
              onClick={handleOpenFolder}
            >
              <FolderOpen size={16} />
              {t("export.openFolder")}
            </Button>
          ) : (
            <Button
              disabled={
                state === "exporting" || previewError || !preview || total === 0
              }
              onClick={handleExport}
            >
              {state === "exporting" && (
                <Loader2 size={16} className="animate-spin" />
              )}
              {t(
                state === "exporting"
                  ? "export.exporting"
                  : state === "error"
                    ? "export.retry"
                    : "export.start",
              )}
              <ArrowRight size={16} />
            </Button>
          )}
        </div>
        {state === "complete" && (
          <button
            className="text-button mt-4 w-full"
            onClick={() => setScreen("landing")}
          >
            {t("export.newSession")}
          </button>
        )}
      </section>
    </div>
  );
}
