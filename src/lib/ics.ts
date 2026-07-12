import { TARGET_LABEL, type HubCourse } from "@/lib/types";

/** Escapes text per RFC 5545 §3.3.11 (TEXT value type). */
function escapeIcsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function toIcsUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** Builds an RFC 5545 .ics calendar of every assignment deadline across a student's courses. */
export function buildDeadlinesIcs(courses: HubCourse[]): string {
  const now = toIcsUtc(new Date().toISOString());
  const events = courses.flatMap((c) =>
    [...c.missing, ...c.done].map((item) => {
      const due = new Date(item.dueAt);
      const start = toIcsUtc(due.toISOString());
      const end = toIcsUtc(new Date(due.getTime() + 30 * 60 * 1000).toISOString());
      const statusLabel = item.status === "submitted" ? "Odevzdáno" : "Nutno odevzdat";
      return [
        "BEGIN:VEVENT",
        `UID:${item.assignmentId}@shtroodle.local`,
        `DTSTAMP:${now}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${escapeIcsText(`${item.title} — ${c.name}`)}`,
        `DESCRIPTION:${escapeIcsText(`${TARGET_LABEL[item.targetType]}. Stav: ${statusLabel}.`)}`,
        "END:VEVENT",
      ].join("\r\n");
    }),
  );
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shtroodle//Odevzdavarna//CS",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(courses: HubCourse[], filename: string) {
  const ics = buildDeadlinesIcs(courses);
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
