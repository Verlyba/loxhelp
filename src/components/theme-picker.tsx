import { Check } from "lucide-react";
import { SUBJECT_THEMES, THEME_META, type SubjectTheme } from "@/lib/roles";

/** Visual swatch/gradient picker for a course's color theme — colors, not course names. */
export function ThemePicker({
  value,
  onChange,
}: {
  value: SubjectTheme;
  onChange: (theme: SubjectTheme) => void;
}) {
  return (
    <div className="mt-1.5 grid grid-cols-6 gap-2 sm:grid-cols-11">
      {SUBJECT_THEMES.map((theme) => {
        const meta = THEME_META[theme];
        const selected = value === theme;
        const background =
          meta.swatch.length === 2
            ? `linear-gradient(135deg, ${meta.swatch[0]}, ${meta.swatch[1]})`
            : meta.swatch[0];
        return (
          <button
            key={theme}
            type="button"
            onClick={() => onChange(theme)}
            title={meta.label}
            aria-label={meta.label}
            aria-pressed={selected}
            className={`group relative flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-background transition-all cursor-pointer ${
              selected
                ? "ring-foreground scale-105"
                : "ring-transparent hover:ring-border hover:scale-105"
            }`}
          >
            <span
              className="h-full w-full rounded-full border border-black/10"
              style={{ background }}
            />
            {selected && (
              <Check
                className="absolute h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                strokeWidth={3}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
