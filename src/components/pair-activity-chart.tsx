import type { PairActivityLane } from "@/lib/types";

// Binary step ("skokový") chart: did each person upload something that week —
// yes or no, never a count. One stepped line per lane, stacked; the first
// lane carries the --subject accent, the rest are de-emphasized gray, so
// exactly two people (a pair) always read clearly without a categorical
// palette or CVD validation.

const COL_W = 48;
const LANE_H = 28;
const LANE_GAP = 6;
const HIGH_Y = 6;
const LOW_Y = 20;
const DOT_R = 4;

const LANE_STYLE = [
  { stroke: "stroke-subject", fill: "fill-subject", bg: "bg-subject" },
  {
    stroke: "stroke-slate-300 dark:stroke-slate-600",
    fill: "fill-slate-300 dark:fill-slate-600",
    bg: "bg-slate-300 dark:bg-slate-600",
  },
  {
    stroke: "stroke-slate-400 dark:stroke-slate-500",
    fill: "fill-slate-400 dark:fill-slate-500",
    bg: "bg-slate-400 dark:bg-slate-500",
  },
];

function laneY(offsetY: number, uploaded: boolean): number {
  return offsetY + (uploaded ? HIGH_Y : LOW_Y);
}

/** Builds the SVG path for one lane's step line across all weeks. */
function stepPath(levels: boolean[], offsetY: number): string {
  let d = `M 0 ${laneY(offsetY, levels[0])}`;
  levels.forEach((level, i) => {
    const xEnd = (i + 1) * COL_W;
    d += ` H ${xEnd}`;
    if (i < levels.length - 1 && level !== levels[i + 1]) {
      d += ` V ${laneY(offsetY, levels[i + 1])}`;
    }
  });
  return d;
}

export function PairActivityChart({
  title,
  subtitle,
  lanes,
}: {
  title?: string;
  subtitle?: string;
  lanes: PairActivityLane[];
}) {
  const weeks = lanes[0]?.weeks ?? [];
  const n = weeks.length;
  if (n === 0) return null;

  const width = n * COL_W;
  const height = lanes.length * LANE_H + (lanes.length - 1) * LANE_GAP;

  const summary = lanes
    .map(
      (lane) =>
        `${lane.name}: ${lane.weeks.map((w) => (w.count > 0 ? `${w.label} ano` : `${w.label} ne`)).join(", ")}`,
    )
    .join(". ");

  return (
    <div>
      {(title || subtitle) && (
        <div className="mb-2">
          {title && <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      {lanes.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {lanes.map((lane, i) => (
            <span key={lane.name} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${LANE_STYLE[i % LANE_STYLE.length].bg}`} />
              {lane.name}
            </span>
          ))}
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: height * 1.4 }}
        role="img"
        aria-label={title ? `${title}. ${summary}` : summary}
      >
        {lanes.map((lane, i) => {
          const offsetY = i * (LANE_H + LANE_GAP);
          const levels = lane.weeks.map((w) => w.count > 0);
          const style = LANE_STYLE[i % LANE_STYLE.length];
          return (
            <g key={lane.name}>
              <path
                d={stepPath(levels, offsetY)}
                className={style.stroke}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {levels.map(
                (up, w) =>
                  up && (
                    <circle
                      key={w}
                      cx={(w + 0.5) * COL_W}
                      cy={laneY(offsetY, true)}
                      r={DOT_R}
                      className={style.fill}
                    >
                      <title>
                        {lane.name} — {lane.weeks[w].label}: nahráno
                      </title>
                    </circle>
                  ),
              )}
              {lane.weeks.map((w, wi) => (
                <rect
                  key={w.weekStart}
                  x={wi * COL_W}
                  y={offsetY}
                  width={COL_W}
                  height={LANE_H}
                  fill="transparent"
                >
                  <title>
                    {lane.name} — {w.label}: {w.count > 0 ? "nahráno" : "bez nahrání"}
                  </title>
                </rect>
              ))}
            </g>
          );
        })}
      </svg>

      <div className="mt-1 flex text-[9px] leading-none text-muted-foreground">
        {weeks.map((w) => (
          <span key={w.weekStart} className="flex-1 text-center">
            {w.label}
          </span>
        ))}
      </div>

      {/* Table-view twin — every value stays reachable without hovering. */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Osoba</th>
            {weeks.map((w) => (
              <th key={w.weekStart}>{w.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lanes.map((lane) => (
            <tr key={lane.name}>
              <td>{lane.name}</td>
              {lane.weeks.map((w) => (
                <td key={w.weekStart}>{w.count > 0 ? "ano" : "ne"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
