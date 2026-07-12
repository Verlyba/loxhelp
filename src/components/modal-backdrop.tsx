import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/lib/use-focus-trap";

/**
 * Shared shell for hand-rolled modals: portals to document.body (so the
 * backdrop's z-index can't lose a stacking fight to a sticky header/sidebar
 * ancestor that has a transform/filter — see GradingModal's original bug),
 * closes on Escape, closes on a backdrop click without closing when the
 * click originated inside the panel itself, and traps Tab focus inside the
 * dialog (otherwise, being portaled to the end of <body>, it's the very
 * last stop in document tab order — a keyboard user hits every button on
 * the page behind it before ever reaching the dialog's own fields).
 */
export function ModalBackdrop({
  onClose,
  ariaLabel,
  children,
  className = "flex items-center justify-center p-4",
}: {
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm ${className}`}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        className="contents"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
