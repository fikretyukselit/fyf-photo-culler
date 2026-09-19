import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  FolderOpen,
  X,
  ArrowRight,
  FolderOutput,
  History,
  Plus,
  ShieldCheck,
  ScanLine,
  Images,
  Check,
  Loader2,
  CircleHelp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useSessionStore,
  usePhotosStore,
  useProgressStore,
  EMPTY_FILTERS,
} from "@/lib/stores";
import { useLocale } from "@/lib/i18n";
import { api, type SessionInfo } from "@/lib/api";

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
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [confirmation, setConfirmation] = useState<
    "replace" | "formats" | null
  >(null);
  const [skipped, setSkipped] = useState(0);
  const [pathMode, setPathMode] = useState<"source" | "output" | null>(null);
  const [path, setPath] = useState("");

  useEffect(() => {
    api
      .getSession()
      .then((s) => setSession(s.resumable ? s : null))
      .catch(() => {});
  }, []);

  function handleResume() {
    usePhotosStore.getState().setActiveCategory("all");
    setScreen("review");
  }

  async function chooseFolder(mode: "source" | "output") {
    if (!("__TAURI_INTERNALS__" in window)) {
      setPathMode(mode);
      setPath("");
      return;
    }
    try {
      const selected = await open({
        directory: true,
        multiple: mode === "source",
        title: t(mode === "source" ? "import.add" : "landing.selectOutput"),
      });
      if (!selected) return;
      const folders = Array.isArray(selected) ? selected : [selected];
      if (mode === "source") folders.forEach(addFolder);
      else setOutputDir(folders[0]);
      setConfirmation(null);
    } catch {
      setError(t("import.failed"));
      setPathMode(mode);
    }
  }

  async function startAnalysis(confirmedFormats = false) {
    if (!inputFolders.length || starting) return;
    setStarting(true);
    setError(null);
    try {
      if (!confirmedFormats) {
        const result = await api.checkFolders(inputFolders);
        if (!result.jpg_count) {
          setError(t("landing.noJpgFound"));
          return;
        }
        if (result.other_count > 0) {
          setSkipped(result.other_count);
          setConfirmation("formats");
          return;
        }
      }
      await api.analyze(inputFolders, mergeMode, outputDir);
      useProgressStore.getState().reset();
      usePhotosStore.setState({
        photos: [],
        filters: { ...EMPTY_FILTERS },
        folderFilter: null,
        selectedIds: new Set(),
        focusIdx: -1,
        detailOpen: false,
        loupeOpen: false,
        comparePhotos: null,
        activeGroupId: null,
      });
      setScreen("processing");
    } catch {
      setError(t("import.startFailed"));
    } finally {
      setStarting(false);
    }
  }

  const steps = [
    { icon: FolderOpen, title: "import.step1", hint: "import.step1Hint" },
    { icon: ScanLine, title: "import.step2", hint: "import.step2Hint" },
    { icon: FolderOutput, title: "import.step3", hint: "import.step3Hint" },
  ] as const;

  return (
    <div className="import-page">
      <div className="import-layout">
        <section className="import-intro">
          <div className="brand-symbol" aria-hidden="true">
            <Images size={27} strokeWidth={1.5} />
          </div>
          <h1>{t("import.title")}</h1>
          <p className="intro-description">{t("import.description")}</p>
          <ol className="import-guide">
            {steps.map(({ icon: Icon, title, hint }) => (
              <li key={title}>
                <span className="guide-icon">
                  <Icon size={19} strokeWidth={1.6} />
                </span>
                <div>
                  <h2>{t(title)}</h2>
                  <p>{t(hint)}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="intro-shortcuts">
            <span>
              <kbd>K</kbd>
              {t("review.keep")}
            </span>
            <span>
              <kbd>M</kbd>
              {t("review.maybe")}
            </span>
            <span>
              <kbd>R</kbd>
              {t("review.reject")}
            </span>
          </div>
          <button
            className="tour-link"
            onClick={() => useSessionStore.getState().setOnboardingOpen(true)}
          >
            <CircleHelp size={15} />
            {t("onboarding.replay")}
          </button>
        </section>
        <section className="import-panel" aria-labelledby="sources-title">
          {session && (
            <div className="resume-banner">
              <History size={19} />
              <div>
                <strong>{t("session.resumeTitle")}</strong>
                <p>
                  {t("session.resumeHint", {
                    total: session.summary?.total ?? 0,
                    keep: session.summary?.keep ?? 0,
                  })}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleResume}>
                {t("session.resume")}
                <ArrowRight size={14} />
              </Button>
            </div>
          )}
          <div className="panel-heading">
            <span className="section-icon">
              <FolderOpen size={20} />
            </span>
            <div>
              <h2 id="sources-title">{t("import.sources")}</h2>
              <p>{t("import.sourcesHint")}</p>
            </div>
          </div>
          <div className="source-well">
            {inputFolders.length === 0 ? (
              <div className="source-empty">
                <div className="folder-illustration" aria-hidden="true">
                  <FolderOpen size={42} strokeWidth={1.2} />
                  <span>
                    <Plus size={13} />
                  </span>
                </div>
                <h3>{t("import.empty")}</h3>
                <p>{t("import.emptyHint")}</p>
                <Button
                  onClick={() => chooseFolder("source")}
                  variant="outline"
                  className="add-folder"
                >
                  <Plus size={16} />
                  {t("import.add")}
                </Button>
              </div>
            ) : (
              <>
                <div className="source-list-heading">
                  <span>
                    {t("import.folderCount", { n: inputFolders.length })}
                  </span>
                  <Check size={15} />
                </div>
                <ul className="source-list">
                  {inputFolders.map((folder, idx) => (
                    <li key={folder}>
                      <FolderOpen size={18} />
                      <div>
                        <strong>
                          {folder.split(/[/\\]/).filter(Boolean).pop()}
                        </strong>
                        <span title={folder}>{folder}</span>
                      </div>
                      <button
                        disabled={starting}
                        className="icon-button"
                        aria-label={t("import.remove", { name: folder })}
                        onClick={() => {
                          removeFolder(idx);
                          setConfirmation(null);
                        }}
                      >
                        <X size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  className="add-source-link"
                  disabled={starting}
                  onClick={() => chooseFolder("source")}
                >
                  <Plus size={15} />
                  {t("import.addMore")}
                </button>
              </>
            )}
            <p className="format-note">{t("import.formats")}</p>
          </div>
          {pathMode && (
            <form
              className="path-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!path.trim()) return;
                if (pathMode === "source") addFolder(path.trim());
                else setOutputDir(path.trim());
                setPathMode(null);
                setConfirmation(null);
              }}
            >
              <label htmlFor="folder-path">{t("import.path")}</label>
              <div>
                <input
                  id="folder-path"
                  autoFocus
                  value={path}
                  placeholder={t("import.pathHint")}
                  onChange={(e) => setPath(e.target.value)}
                />
                <Button size="sm" type="submit" disabled={!path.trim()}>
                  {t("import.pathAdd")}
                </Button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setPathMode(null)}
                  aria-label={t("review.close")}
                >
                  <X size={16} />
                </button>
              </div>
            </form>
          )}
          <div className="destination-row">
            <FolderOutput size={19} />
            <div>
              <h3>{t("import.destination")}</h3>
              <p title={outputDir}>
                {outputDir || t("import.defaultDestination")}
              </p>
            </div>
            <button
              className="text-button"
              disabled={starting}
              onClick={() => chooseFolder("output")}
            >
              {t("import.change")}
            </button>
          </div>
          <label className="merge-option">
            <input
              type="checkbox"
              checked={mergeMode}
              disabled={starting}
              onChange={(e) => setMergeMode(e.target.checked)}
            />
            <span>
              <strong>{t("landing.mergeMode")}</strong>
              <small>{t("import.mergeHint")}</small>
            </span>
          </label>
          {error && (
            <div role="alert" className="inline-error">
              {error}
            </div>
          )}
          {confirmation && (
            <div className="inline-notice" role="alert">
              <p>
                {confirmation === "replace"
                  ? t("import.replace")
                  : t("import.skipped", { n: skipped })}
              </p>
              <div>
                <Button
                  size="sm"
                  disabled={starting}
                  onClick={() => startAnalysis(confirmation === "formats")}
                >
                  {t(
                    confirmation === "replace"
                      ? "import.replaceAction"
                      : "import.continue",
                  )}
                </Button>
                <button
                  className="text-button"
                  disabled={starting}
                  onClick={() => setConfirmation(null)}
                >
                  {t("import.cancel")}
                </button>
              </div>
            </div>
          )}
          {!confirmation && (
            <Button
              className="start-analysis"
              disabled={!inputFolders.length || starting}
              onClick={() =>
                session ? setConfirmation("replace") : startAnalysis()
              }
            >
              {starting ? (
                <Loader2 className="animate-spin" size={17} />
              ) : (
                <ScanLine size={17} />
              )}{" "}
              {t(starting ? "landing.starting" : "landing.startCulling")}
              <ArrowRight size={16} />
            </Button>
          )}
          <p className="source-safety">
            <ShieldCheck size={14} />
            {t("import.safe")}
          </p>
        </section>
      </div>
      <footer className="import-footer">
        <span>Fikret Yüksel Foundation</span>
        <span>FRC media tools</span>
      </footer>
    </div>
  );
}
