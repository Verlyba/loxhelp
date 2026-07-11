// Parses a Moodle quiz-results export (CSV or JSON) into plain rows, matches
// each row to an enrolled student by email/name, and grades it from the
// course's configured thresholds. Keeps parsing separate from the server
// actions that persist the result, since the format-sniffing here is fiddly
// and worth testing/reading in isolation.

// Keys are already diacritic/case-stripped — lookups always go through
// normalize() below, so accented spellings ("května") never match verbatim.
const CZECH_MONTHS: Record<string, number> = {
  ledna: 0,
  unora: 1,
  brezna: 2,
  dubna: 3,
  kvetna: 4,
  cervna: 5,
  cervence: 6,
  srpna: 7,
  zari: 8,
  rijna: 9,
  listopadu: 10,
  prosince: 11,
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** "6. března 2026  11.55" -> Date, or null if it doesn't parse. */
export function parseCzechDateTime(raw: string): Date | null {
  const m = /(\d{1,2})\.\s*([^\s0-9]+)\s+(\d{4})\s+(\d{1,2})[.:](\d{2})/.exec(raw.trim());
  if (!m) return null;
  const [, day, monthWord, year, hour, minute] = m;
  const month = CZECH_MONTHS[normalize(monthWord)];
  if (month === undefined) return null;
  return new Date(Number(year), month, Number(day), Number(hour), Number(minute));
}

/** "5 min. 7 sekund" / "9 min." / "4 min. 1 sek." -> seconds, or null. */
export function parseDurationSeconds(raw: string): number | null {
  const min = /(\d+)\s*min/.exec(raw);
  const sec = /(\d+)\s*sek/.exec(raw);
  if (!min && !sec) return null;
  return (min ? Number(min[1]) * 60 : 0) + (sec ? Number(sec[1]) : 0);
}

/** Czech decimal-comma number ("6,67") -> 6.67. */
function parseCzechNumber(raw: string): number | null {
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export interface MoodleRow {
  lastName: string;
  firstName: string;
  email: string;
  startedAt: Date | null;
  completedAt: Date | null;
  durationSeconds: number | null;
  score: number;
}

/** Finds the raw column key whose normalized form matches any candidate substring. */
function findKey(keys: string[], candidates: string[], exclude: string[] = []): string | null {
  for (const key of keys) {
    const n = normalize(key);
    if (exclude.some((e) => n.includes(e))) continue;
    if (candidates.some((c) => n.includes(c))) return key;
  }
  return null;
}

function rowsFromRecords(records: Record<string, string>[]): MoodleRow[] {
  if (records.length === 0) return [];
  const keys = Object.keys(records[0]);
  const lastNameKey = findKey(keys, ["prijmen", "pjmen"]);
  const firstNameKey = findKey(
    keys,
    ["krestnijmeno", "kestnjmno", "jmeno"],
    ["prijmen", "pjmen", "mail"],
  );
  const emailKey = findKey(keys, ["mail"]);
  const startedKey = findKey(keys, ["zapocet", "zahaje", "zapoet"]);
  const completedKey = findKey(keys, ["hotovo", "dokonc"]);
  const durationKey = findKey(keys, ["dlka", "trvani", "doba"]);
  const scoreKey = findKey(keys, ["znmka", "znamka", "hodnoceni", "grade", "body"]);
  if (!scoreKey) throw new Error("Ve souboru se nepodařilo najít sloupec se známkou/body.");

  const rows: MoodleRow[] = [];
  for (const r of records) {
    const email = (emailKey ? r[emailKey] : "")?.trim();
    if (!email) continue; // summary rows ("Skupinový průměr", …) have no email
    const score = parseCzechNumber(r[scoreKey] ?? "");
    if (score === null) continue;
    rows.push({
      lastName: (lastNameKey ? r[lastNameKey] : "")?.trim() ?? "",
      firstName: (firstNameKey ? r[firstNameKey] : "")?.trim() ?? "",
      email,
      startedAt: startedKey ? parseCzechDateTime(r[startedKey] ?? "") : null,
      completedAt: completedKey ? parseCzechDateTime(r[completedKey] ?? "") : null,
      durationSeconds: durationKey ? parseDurationSeconds(r[durationKey] ?? "") : null,
      score,
    });
  }
  return rows;
}

/** Flattens Moodle's occasionally double-wrapped JSON export ([[ {...}, … ]]). */
function flattenJson(value: unknown): Record<string, string>[] {
  if (Array.isArray(value)) return value.flatMap(flattenJson);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = String(v ?? "");
    return [out];
  }
  return [];
}

/** Minimal RFC4126-ish CSV parser: quoted fields, escaped quotes, auto delimiter. */
function parseCsv(text: string): Record<string, string>[] {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = withoutBom.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const delimiter = lines[0].split(";").length >= lines[0].split(",").length ? ";" : ",";

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === delimiter) {
        out.push(field);
        field = "";
      } else {
        field += c;
      }
    }
    out.push(field);
    return out;
  };

  const header = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const rec: Record<string, string> = {};
    header.forEach((h, i) => (rec[h] = cells[i] ?? ""));
    return rec;
  });
}

/** Parses a Moodle quiz-results export. Detects JSON vs CSV from content. */
export function parseMoodleFile(fileName: string, content: string): MoodleRow[] {
  const trimmed = content.trim();
  const looksJson = fileName.toLowerCase().endsWith(".json") || /^[[{]/.test(trimmed);
  const records = looksJson ? flattenJson(JSON.parse(trimmed)) : parseCsv(trimmed);
  return rowsFromRecords(records);
}

export interface GradeThresholds {
  grade1Min: number;
  grade2Min: number;
  grade3Min: number;
  grade4Min: number;
}

/** Defaults used when a course has no saved SubjectGradingSettings row yet. */
export const DEFAULT_GRADING_SETTINGS = {
  grade1Min: 90,
  grade2Min: 75,
  grade3Min: 60,
  grade4Min: 40,
  latePenaltyEnabled: true,
  latePenaltyWeight: 0.5,
};

/** Percentage of max points -> "1".."5", by the course's configured thresholds. */
export function gradeFromPercentage(percentage: number, t: GradeThresholds): string {
  if (percentage >= t.grade1Min) return "1";
  if (percentage >= t.grade2Min) return "2";
  if (percentage >= t.grade3Min) return "3";
  if (percentage >= t.grade4Min) return "4";
  return "5";
}

export interface StudentCandidate {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

/** Matches a row to an enrolled student: exact email first, then full-name fallback. */
export function matchStudent(
  row: MoodleRow,
  students: StudentCandidate[],
): StudentCandidate | null {
  const email = row.email.toLowerCase();
  const byEmail = students.find((s) => s.email.toLowerCase() === email);
  if (byEmail) return byEmail;

  const target = normalize(`${row.lastName}${row.firstName}`);
  return students.find((s) => normalize(`${s.lastName}${s.firstName}`) === target) ?? null;
}
