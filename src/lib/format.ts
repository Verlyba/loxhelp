export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" });

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
