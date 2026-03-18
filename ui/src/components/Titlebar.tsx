import { useEffect, useState } from "react";
import { Sun, Moon, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/lib/stores";
import { useLocale } from "@/lib/i18n";
import fyfIcon from "@/assets/orta.png";

function useIsMac() {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    setIsMac(navigator.userAgent.includes("Mac"));
  }, []);
  return isMac;
}

function handleDrag(e: React.MouseEvent) {
  if (e.button !== 0) return;
  if ((e.target as HTMLElement).closest("button")) return;
  if (e.detail === 2) {
    getCurrentWindow().toggleMaximize();
  } else {
    getCurrentWindow().startDragging();
  }
}

async function windowAction(action: "minimize" | "maximize" | "close") {
  const win = getCurrentWindow();
  if (action === "minimize") await win.minimize();
  else if (action === "maximize") await win.toggleMaximize();
  else await win.close();
}

function MacTrafficLights() {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex items-center gap-2 pl-3"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={() => windowAction("close")}
        className={cn(
          "size-3 rounded-full transition-colors",
          hovered ? "bg-[#ff5f57]" : "bg-foreground/20"
        )}
      >
        {hovered && (
          <svg viewBox="0 0 12 12" className="size-3 text-black/60">
            <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        )}
      </button>
      <button
        onClick={() => windowAction("minimize")}
        className={cn(
          "size-3 rounded-full transition-colors",
          hovered ? "bg-[#febc2e]" : "bg-foreground/20"
        )}
      >
        {hovered && (
          <svg viewBox="0 0 12 12" className="size-3 text-black/60">
            <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        )}
      </button>
      <button
        onClick={() => windowAction("maximize")}
        className={cn(
          "size-3 rounded-full transition-colors",
          hovered ? "bg-[#28c840]" : "bg-foreground/20"
        )}
      >
        {hovered && (
          <svg viewBox="0 0 12 12" className="size-3 text-black/60">
            <path d="M3 8.5l3-5 3 5" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function Titlebar() {
  const { theme, toggleTheme } = useSessionStore();
  const { locale, setLocale } = useLocale();
  const isMac = useIsMac();

  return (
    <header
      onMouseDown={handleDrag}
      className="glass fixed top-0 left-0 right-0 z-50 flex h-[38px] items-center border-b border-border cursor-default rounded-t-[10px]"
    >
      {/* Left: macOS traffic lights or spacer */}
      {isMac ? (
        <MacTrafficLights />
      ) : (
        <div className="w-3 shrink-0" />
      )}

      {/* Center: Logo + Title */}
      <div className="flex flex-1 items-center justify-center gap-2 select-none pointer-events-none">
        <img src={fyfIcon} alt="FYF" className="h-5 w-auto object-contain" />
        <span className="text-sm font-semibold tracking-wide text-foreground/70">
          Photo Culler
        </span>
      </div>

      {/* Right: Controls */}
      <div className="flex shrink-0 items-center gap-1 pr-3">
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
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        {/* Windows window controls */}
        {!isMac && (
          <div className="ml-1 flex items-center -mr-3">
            <button
              onClick={() => windowAction("minimize")}
              className="flex h-[38px] w-[46px] items-center justify-center text-foreground/60 transition-colors hover:bg-foreground/10"
            >
              <Minus className="size-4" />
            </button>
            <button
              onClick={() => windowAction("maximize")}
              className="flex h-[38px] w-[46px] items-center justify-center text-foreground/60 transition-colors hover:bg-foreground/10"
            >
              <Square className="size-3.5" />
            </button>
            <button
              onClick={() => windowAction("close")}
              className="flex h-[38px] w-[46px] items-center justify-center text-foreground/60 transition-colors hover:bg-red-500 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
