import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Shared cover-image field for subject forms: upload from the PC (downscaled
// client-side so the data URL stays small), paste a URL, or pick a preset.

const COVER_PRESETS = [
  {
    name: "Chytrý dům (Loxone)",
    url: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "3D CAD & Engineering",
    url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "Programování & Web",
    url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "Počítačové sítě",
    url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "Technologie & Studium",
    url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80",
  },
];

/** Downscales an image file to a compact JPEG data URL (fits DB + payload limits). */
async function fileToCoverDataUrl(file: File, maxWidth = 1280, quality = 0.82): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Vyberte prosím obrázek (JPG, PNG, …).");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxWidth / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Prohlížeč nepodporuje zpracování obrázků.");
    // white behind transparent PNGs — JPEG has no alpha
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    bitmap.close();
  }
}

export function CoverImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const isUploaded = value.startsWith("data:");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await fileToCoverDataUrl(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Obrázek se nepodařilo načíst.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-2 text-xs font-semibold text-muted-foreground">
      <span>Obrázek kurzu</span>

      {value && (
        <div className="relative h-28 overflow-hidden rounded-lg border border-border bg-muted">
          <img src={value} alt="Náhled obrázku kurzu" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Odebrat obrázek"
            title="Odebrat obrázek"
            className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {isUploaded && (
            <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
              Vlastní obrázek z PC
            </span>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-accent disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {busy ? "Zpracovávám…" : "Nahrát z počítače"}
        </button>
        <input
          type="text"
          value={isUploaded ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isUploaded ? "Nahrán vlastní obrázek" : "nebo vložte URL obrázku"}
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div>
        Předvolby obrázků
        <div className="mt-1.5 grid grid-cols-5 gap-1.5">
          {COVER_PRESETS.map((preset) => (
            <button
              key={preset.url}
              type="button"
              onClick={() => onChange(preset.url)}
              className={`relative aspect-video overflow-hidden rounded-md border-2 bg-muted transition-all cursor-pointer ${
                value === preset.url
                  ? "border-primary scale-95 shadow-sm"
                  : "border-transparent hover:border-muted-foreground/30"
              }`}
              title={preset.name}
            >
              <img src={preset.url} alt={preset.name} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
