import { Check, ChevronRight, HardDrive } from "lucide-react";
import { useSessionStore } from "@/lib/stores";
import { useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const steps = [
  "workspace.import",
  "workspace.analyze",
  "workspace.review",
  "workspace.export",
] as const;
const screens = ["landing", "processing", "review", "export"];

export function Workflow() {
  const screen = useSessionStore((s) => s.screen);
  const { t } = useLocale();
  const active = screens.indexOf(screen);
  return (
    <div className="workflow-bar">
      <span className="workspace-brand">
        FYF <span>Photo Culler</span>
      </span>
      <nav aria-label={t("workspace.workflow")}>
        <ol className="workflow-steps">
          {steps.map((step, i) => (
            <li
              key={step}
              className={cn(
                "workflow-step",
                active === i && "is-active",
                active > i && "is-done",
              )}
              aria-current={active === i ? "step" : undefined}
            >
              {i > 0 && <ChevronRight className="step-divider" size={14} />}
              <span className="step-number">
                {active > i ? <Check size={12} /> : i + 1}
              </span>
              <span>{t(step)}</span>
            </li>
          ))}
        </ol>
      </nav>
      <span className="local-status">
        <HardDrive size={14} />
        {t("workspace.local")}
      </span>
    </div>
  );
}
