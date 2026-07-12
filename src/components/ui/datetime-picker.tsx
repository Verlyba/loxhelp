"use client";

import * as React from "react";
import { CalendarIcon, Clock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function parseLocalValue(value: string): Date | undefined {
  if (!value) return undefined;
  const [datePart, timePart] = value.split("T");
  if (!datePart) return undefined;
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = (timePart ?? "00:00").split(":").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, hh || 0, mm || 0);
}

function toLocalValue(date: Date, time: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T${time || "00:00"}`;
}

/**
 * Universal date + time picker: a calendar popover for the date plus a native
 * time field, replacing raw `<input type="datetime-local">` everywhere. The
 * value/onChange contract matches datetime-local's string format
 * (`YYYY-MM-DDTHH:mm`) so it's a drop-in swap at call sites.
 */
export function DateTimePicker({
  value,
  onChange,
  required,
  className,
  id,
  placeholder = "Vybrat datum a čas",
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = parseLocalValue(value);
  const time = value?.split("T")[1]?.slice(0, 5) || "12:00";

  const label = selected
    ? selected.toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" })
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          className={cn(
            "flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring/50",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(toLocalValue(date, time));
          }}
        />
        <div className="flex items-center gap-2 border-t border-border p-3">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="time"
            required={required}
            value={time}
            onChange={(e) => onChange(toLocalValue(selected ?? new Date(), e.target.value))}
            className="w-full flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="subject-button shrink-0 !px-2.5 !py-1 text-xs"
          >
            Hotovo
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
