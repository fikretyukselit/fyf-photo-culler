import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/lib/stores";
import { useLocale } from "@/lib/i18n";
import fyfIcon from "@/assets/orta.png";

export function Titlebar() {
  const { theme, toggleTheme } = useSessionStore();
  const { locale, setLocale } = useLocale();

  return (
    <header
      className={cn(
        "glass fixed top-0 left-0 right-0 z-50 flex h-[38px] items-center border-b border-border px-4"
      )}
    >
      {/* Traffic light spacer for macOS */}
      <div data-tauri-drag-region className="w-[70px] shrink-0" />

      <div
        data-tauri-drag-region
        className="flex flex-1 items-center justify-center gap-2 select-none"
      >
        <img src={fyfIcon} alt="FYF" className="h-5 w-auto object-contain" />
        <span className="text-sm font-semibold tracking-wide text-foreground/70">
          Photo Culler
        </span>
      </div>

      <div className="flex w-[70px] shrink-0 items-center justify-end gap-1">
        <button
          onClick={() => setLocale(locale === "en" ? "tr" : "en")}
          className="rounded-md px-1.5 py-0.5 text-xs font-medium text-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground/80"
        >
          {locale === "en" ? "TR" : "EN"}
        </button>
        <button
          onClick={toggleTheme}
          className="rounded-md p-1.5 text-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground/80"
        >
          {theme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </button>
      </div>
    </header>
  );
}
