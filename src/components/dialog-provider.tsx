import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, HelpCircle, X } from "lucide-react";
import { useFocusTrap } from "@/lib/use-focus-trap";

// App-styled replacement for window.confirm() / window.prompt(). Usage:
//   const { confirm, prompt } = useDialog();
//   if (!(await confirm({ title: "Smazat?", danger: true }))) return;
//   const pw = await prompt({ title: "Nové heslo", defaultValue: "heslo123" });

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptOptions {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
}

interface DialogContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

type ActiveDialog =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void };

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, !!dialog);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setDialog({ kind: "confirm", opts, resolve })),
    [],
  );

  const prompt = useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setValue(opts.defaultValue ?? "");
        setDialog({ kind: "prompt", opts, resolve });
      }),
    [],
  );

  const close = (result: boolean | string | null) => {
    if (!dialog) return;
    if (dialog.kind === "confirm") dialog.resolve(result === true);
    else dialog.resolve(typeof result === "string" ? result : null);
    setDialog(null);
  };

  const danger = dialog?.kind === "confirm" && dialog.opts.danger;

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}

      {dialog && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => close(null)}
          onKeyDown={(e) => e.key === "Escape" && close(null)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={dialog.opts.title}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-elevated)]"
          >
            <div className="flex items-start gap-3 p-5">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                  danger ? "bg-red-50 text-red-600" : "bg-muted text-muted-foreground"
                }`}
              >
                {danger ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <HelpCircle className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-base font-bold text-foreground">
                  {dialog.opts.title}
                </h3>
                {dialog.opts.message && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {dialog.opts.message}
                  </p>
                )}
                {dialog.kind === "prompt" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      close(value);
                    }}
                  >
                    <input
                      ref={inputRef}
                      autoFocus
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={dialog.opts.placeholder}
                      className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </form>
                )}
              </div>
              <button
                onClick={() => close(null)}
                aria-label="Zavřít"
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
              <button
                onClick={() => close(null)}
                className="rounded-lg border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {(dialog.kind === "confirm" && dialog.opts.cancelLabel) || "Zrušit"}
              </button>
              <button
                autoFocus={dialog.kind === "confirm"}
                onClick={() => close(dialog.kind === "prompt" ? value : true)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold ${
                  danger
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                {dialog.opts.confirmLabel ?? (danger ? "Smazat" : "Potvrdit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within <DialogProvider>");
  return ctx;
}
