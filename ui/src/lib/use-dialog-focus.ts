import { useEffect, useRef } from "react";

const dialogs: HTMLElement[] = [];

/** Keep keyboard focus inside the topmost tool and restore its trigger on close. */
export function useDialogFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!open || !element) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialogs.push(element);
    element.focus();
    function trap(event: KeyboardEvent) {
      if (
        event.key !== "Tab" ||
        dialogs[dialogs.length - 1] !== element ||
        !element
      )
        return;
      const targets = [
        ...element.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ),
      ].filter((node) => node.getClientRects().length > 0);
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (!first) {
        event.preventDefault();
        element.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === element)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === element)
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", trap, true);
    return () => {
      window.removeEventListener("keydown", trap, true);
      const index = dialogs.indexOf(element);
      if (index >= 0) dialogs.splice(index, 1);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  return ref;
}
