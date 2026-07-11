import type { PairActivityLane } from "@/lib/types";

// Binary step ("skokový") chart: did each person upload something that week —
// yes or no, never a count. All lanes share one axis (uploaded / not
// uploaded) so overlapping weeks read as "same" at a glance; a small
// per-lane jitter keeps both lines visible even when they fully coincide,
// each in its own clearly-visible categorical color (never a pale gray).

const COL_W = 48;
const BAND_H = 40;
const HIGH_Y = 8;
const LOW_Y = 32;
const JITTER_STEP = 3;
const DOT_R = 4;

const LANE_STYLE = [
  { stroke: "stroke-subject", fill: "fill-subject", bg: "bg-subject" },
  {
    stroke: "stroke-blue-500 dark:stroke-blue-400",
    fill: "fill-blue-500 dark:fill-blue-400",
    bg: "bg-blue-500 dark:bg-blue-400",
  },
  {
    stroke: "stroke-amber-500 dark:stroke-amber-400",
    fill: "fill-amber-500 dark:fill-amber-400",
    bg: "bg-amber-500 dark:bg-amber-400",
  },
];

function laneY(jitter: number, uploaded: boolean): number {
  return jitter + (uploaded ? HIGH_Y : LOW_Y);
}

/** Builds the SVG path for one lane's step line across all weeks. */
function stepPath(levels: boolean[], jitter: number): string {
  let d = `M 0 ${laneY(jitter, levels[0])}`;
  levels.forEach((level, i) => {
    const xEnd = (i + 1) * COL_W;
    d += ` H ${xEnd}`;
    if (i < levels.length - 1 && level !== levels[i + 1]) {
      d += ` V ${laneY(jitter, levels[i + 1])}`;
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
  const height = BAND_H;
  const mid = (lanes.length - 1) / 2;

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
          const jitter = (i - mid) * JITTER_STEP;
          const levels = lane.weeks.map((w) => w.count > 0);
          const style = LANE_STYLE[i % LANE_STYLE.length];
          return (
            <g key={lane.name}>
              <path
                d={stepPath(levels, jitter)}
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
                      cy={laneY(jitter, true)}
                      r={DOT_R}
                      className={style.fill}
                    >
                      <title>
                        {lane.name} — {lane.weeks[w].label}: nahráno
                      </title>
                    </circle>
                  ),
              )}
            </g>
          );
        })}

        {/* One transparent hit-area per week, combining every lane's status
            into a single hover tooltip (drawn last so it sits on top). */}
        {weeks.map((w, wi) => (
          <rect key={w.weekStart} x={wi * COL_W} y={0} width={COL_W} height={height} fill="transparent">
            <title>
              {w.label}: {lanes.map((l) => `${l.name} ${l.weeks[wi].count > 0 ? "nahráno" : "bez nahrání"}`).join(", ")}
            </title>
          </rect>
        ))}
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
