export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" });

/**
 * Converts a UTC ISO timestamp to the value a `<input type="datetime-local">`
 * needs to display it correctly in the browser's local timezone. Slicing the
 * raw ISO string instead (`iso.slice(0, 16)`) puts the UTC wall-clock digits
 * into a local-time field, silently shifting the time by the UTC offset on
 * every save — even a save that never touches the date.
 */
export function toLocalDatetimeInputValue(iso: string): string {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("cs-CZ", { dateStyle: "medium" });

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["kB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}
