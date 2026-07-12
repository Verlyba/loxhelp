import { toast } from "sonner";
import { ModalBackdrop } from "@/components/modal-backdrop";

/** Shows the shared initial password after account creation/reset, with copy-to-clipboard. */
export function PasswordReveal({
  name,
  password,
  onClose,
}: {
  name: string;
  password: string;
  onClose: () => void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Heslo zkopírováno do schránky.");
    } catch {
      toast.error("Kopírování selhalo — opište heslo ručně.");
    }
  };

  return (
    <ModalBackdrop onClose={onClose} ariaLabel="Účet vytvořen">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-elevated)]">
        <div className="p-6 text-center">
          <h3 className="font-display text-lg font-bold">Účet vytvořen</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{name}</span> dostal sdílené výchozí
            heslo — při prvním přihlášení si ho bude muset změnit na vlastní:
          </p>
          <button
            onClick={copy}
            title="Kliknutím zkopírujete"
            className="mono mt-4 inline-block cursor-pointer rounded-xl border border-dashed border-subject/50 bg-subject-soft px-6 py-3 text-2xl font-bold tracking-wide hover:opacity-90"
          >
            {password}
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Kliknutím na heslo ho zkopírujete. Po prvním přihlášení ho nikdo — ani vy — už neuvidí.
          </p>
        </div>
        <footer className="flex justify-center border-t border-border bg-muted/30 px-6 py-3">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Hotovo, heslo mám
          </button>
        </footer>
      </div>
    </ModalBackdrop>
  );
}
