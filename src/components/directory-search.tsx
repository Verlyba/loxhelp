import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Search, X, User, BookOpen } from "lucide-react";
import { searchDirectory } from "@/lib/data";
import type { SearchResult } from "@/lib/types";
import { ModalBackdrop } from "@/components/modal-backdrop";

/** False during SSR and the first client render (so hydration always matches), then set on mount. */
function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
  }, []);
  return isMac;
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/** Query + keyboard-nav state shared by the desktop inline box and the mobile overlay. */
function useDirectorySearchState() {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const search = useServerFn(searchDirectory);
  const debouncedQuery = useDebounced(query, 200);

  const { data: results, isFetching } = useQuery({
    queryKey: ["directory-search", debouncedQuery],
    queryFn: () => search({ data: { query: debouncedQuery } }),
    enabled: debouncedQuery.trim().length >= 2,
  });

  const items = debouncedQuery.trim().length >= 2 ? (results ?? []) : [];

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length, debouncedQuery]);

  const go = (item: SearchResult) => {
    setQuery("");
    navigate({ to: item.href });
  };

  const onKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    isOpen: boolean,
    onEscape: () => void,
  ) => {
    if (e.key === "Escape") {
      onEscape();
      return;
    }
    if (!isOpen || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[activeIndex];
      if (item) go(item);
    }
  };

  return {
    query,
    setQuery,
    debouncedQuery,
    items,
    isFetching,
    activeIndex,
    setActiveIndex,
    go,
    onKeyDown,
  };
}

function ResultRow({
  item,
  active,
  onHover,
  onSelect,
}: {
  item: SearchResult;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <li role="option" aria-selected={active}>
      <button
        type="button"
        onMouseEnter={onHover}
        onClick={onSelect}
        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
          active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
        }`}
      >
        {item.kind === "student" ? (
          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium">{item.label}</span>
          <span className="ml-1.5 text-xs text-muted-foreground">{item.sublabel}</span>
        </span>
      </button>
    </li>
  );
}

/** Global staff-only search over students and subjects, reachable from any page. */
export function DirectorySearch() {
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  // Cmd/Ctrl+K opens whichever variant is currently visible for the viewport.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.matchMedia("(min-width: 768px)").matches) {
          desktopInputRef.current?.focus();
        } else {
          mobileTriggerRef.current?.click();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <DesktopDirectorySearch inputRef={desktopInputRef} />
      <MobileDirectorySearch triggerRef={mobileTriggerRef} />
    </>
  );
}

function DesktopDirectorySearch({
  inputRef,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const s = useDirectorySearchState();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMac = useIsMac();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={s.query}
          placeholder="Hledat žáka nebo předmět…"
          onChange={(e) => {
            s.setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => s.onKeyDown(e, open, () => setOpen(false))}
          role="combobox"
          aria-expanded={open && s.items.length > 0}
          aria-controls="directory-search-results"
          className="w-56 rounded-md border border-border bg-background/60 py-1.5 pl-8 pr-7 text-sm outline-none focus:ring-2 focus:ring-ring/40"
        />
        {s.query ? (
          <button
            type="button"
            aria-label="Vymazat hledání"
            onClick={() => {
              s.setQuery("");
              setOpen(false);
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {isMac ? "⌘K" : "Ctrl+K"}
          </kbd>
        )}
      </div>

      {open && s.debouncedQuery.trim().length >= 2 && (
        <ul
          id="directory-search-results"
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-80 w-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-elevated"
        >
          {s.isFetching && s.items.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">Hledám…</li>
          )}
          {!s.isFetching && s.items.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">Nic nenalezeno.</li>
          )}
          {s.items.map((item, i) => (
            <ResultRow
              key={`${item.kind}-${item.id}`}
              item={item}
              active={i === s.activeIndex}
              onHover={() => s.setActiveIndex(i)}
              onSelect={() => {
                s.go(item);
                setOpen(false);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Icon-triggered full-screen search for mobile, where the inline desktop box has no room. */
function MobileDirectorySearch({
  triggerRef,
}: {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const s = useDirectorySearchState();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    s.setQuery("");
  };

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Hledat žáka nebo předmět"
        onClick={() => setOpen(true)}
        className="md:hidden rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Search className="h-4.5 w-4.5" />
      </button>

      {open && (
        <ModalBackdrop
          onClose={close}
          ariaLabel="Hledat žáka nebo předmět"
          className="items-start justify-center p-3 pt-16"
        >
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-elevated)]">
            <div className="flex items-center gap-2 border-b border-border p-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={s.query}
                placeholder="Hledat žáka nebo předmět…"
                onChange={(e) => s.setQuery(e.target.value)}
                onKeyDown={(e) => s.onKeyDown(e, true, close)}
                role="combobox"
                aria-expanded={s.items.length > 0}
                aria-controls="directory-search-mobile-results"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                aria-label="Zavřít hledání"
                onClick={close}
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {s.debouncedQuery.trim().length >= 2 && (
              <ul
                id="directory-search-mobile-results"
                role="listbox"
                className="max-h-[60vh] overflow-y-auto p-1"
              >
                {s.isFetching && s.items.length === 0 && (
                  <li className="px-3 py-2 text-xs text-muted-foreground">Hledám…</li>
                )}
                {!s.isFetching && s.items.length === 0 && (
                  <li className="px-3 py-2 text-xs text-muted-foreground">Nic nenalezeno.</li>
                )}
                {s.items.map((item, i) => (
                  <ResultRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    active={i === s.activeIndex}
                    onHover={() => s.setActiveIndex(i)}
                    onSelect={() => {
                      s.go(item);
                      close();
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </ModalBackdrop>
      )}
    </>
  );
}
