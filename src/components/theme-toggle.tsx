import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { getPreferredTheme, setTheme, type Theme } from "@/lib/theme";

/** Toggle between light and dark; starts undefined until mount to match the SSR bootstrap script instead of guessing. */
export function ThemeToggle() {
  const [theme, setLocalTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setLocalTheme(getPreferredTheme());
  }, []);

  if (theme === null) {
    return <span className="h-8 w-8 shrink-0" aria-hidden="true" />;
  }

  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={theme === "dark" ? "Přepnout na světlý režim" : "Přepnout na tmavý režim"}
      title={theme === "dark" ? "Světlý režim" : "Tmavý režim"}
      onClick={() => {
        setTheme(next);
        setLocalTheme(next);
      }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
