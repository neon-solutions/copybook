"use client";

import { useId, useState } from "react";
import type { ChangeEvent, CSSProperties, PointerEvent } from "react";

import type { DownloadDay } from "@/lib/npm-stats";
import { cn } from "@/lib/utils";

const WIDTH = 960;
const HEIGHT = 320;
const MARGIN = { bottom: 36, left: 48, right: 16, top: 16 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
const GRID_LINES = 4;
const X_TICKS = 4;
const MARKER_RADIUS = 4;
const NICE_STEPS = [1, 1.2, 2, 4, 6, 8, 10] as const;

const DAY_LABEL = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const DAY_LONG = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});
const COMPACT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});
const EXACT = new Intl.NumberFormat("en-US");

const toDate = (day: string) => new Date(`${day}T00:00:00Z`);

/**
 * The axis top: the smallest step times a power of ten that's at least
 * `value`. Each step splits into four round grid lines.
 */
const niceCeiling = (value: number) => {
  if (value <= 0) {
    return 1;
  }
  const power = 10 ** Math.floor(Math.log10(value));
  const step =
    NICE_STEPS.find((factor) => factor * power >= value) ??
    NICE_STEPS.at(-1) ??
    10;
  return step * power;
};

/**
 * A smooth path through the points that never overshoots them (monotone
 * cubic interpolation), so a quiet day never dips below zero.
 */
const monotonePath = (points: readonly (readonly [number, number])[]) => {
  const count = points.length;
  if (count === 0) {
    return "";
  }
  const [first] = points;
  if (!first) {
    return "";
  }
  if (count === 1) {
    return `M${first[0]},${first[1]}`;
  }
  const slopes: number[] = [];
  for (let index = 0; index < count - 1; index += 1) {
    const [x0, y0] = points[index] ?? first;
    const [x1, y1] = points[index + 1] ?? first;
    slopes.push((y1 - y0) / (x1 - x0));
  }
  const tangents = points.map((_, index) => {
    if (index === 0) {
      return slopes[0] ?? 0;
    }
    if (index === count - 1) {
      return slopes[count - 2] ?? 0;
    }
    const before = slopes[index - 1] ?? 0;
    const after = slopes[index] ?? 0;
    return before * after <= 0 ? 0 : (2 * before * after) / (before + after);
  });
  let path = `M${first[0]},${first[1]}`;
  for (let index = 0; index < count - 1; index += 1) {
    const [x0, y0] = points[index] ?? first;
    const [x1, y1] = points[index + 1] ?? first;
    const third = (x1 - x0) / 3;
    const c1 = [x0 + third, y0 + third * (tangents[index] ?? 0)];
    const c2 = [x1 - third, y1 - third * (tangents[index + 1] ?? 0)];
    path += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${x1},${y1}`;
  }
  return path;
};

const tickIndexes = (count: number) => {
  if (count <= 1) {
    return [0];
  }
  const indexes = new Set<number>();
  for (let tick = 0; tick < X_TICKS; tick += 1) {
    indexes.add(Math.round((tick * (count - 1)) / (X_TICKS - 1)));
  }
  return [...indexes];
};

const tickAnchor = (index: number, last: number) => {
  if (index === 0) {
    return "start";
  }
  return index === last ? "end" : "middle";
};

/** Both packages' downloads per day, with a crosshair and tooltip on hover or arrow keys. */
export const DownloadsChart = ({ data }: { data: readonly DownloadDay[] }) => {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);

  const last = data.length - 1;
  const max = niceCeiling(Math.max(...data.map((entry) => entry.downloads)));
  const step = data.length > 1 ? PLOT_WIDTH / last : 0;
  const x = (index: number) => MARGIN.left + index * step;
  const y = (downloads: number) =>
    MARGIN.top + PLOT_HEIGHT - (downloads / max) * PLOT_HEIGHT;
  const line = monotonePath(
    data.map((entry, index) => [x(index), y(entry.downloads)] as const)
  );
  const baseline = MARGIN.top + PLOT_HEIGHT;
  const area = `${line} L${x(last)},${baseline} L${x(0)},${baseline} Z`;
  const activeEntry = active === null ? undefined : data[active];
  const describe = (entry: DownloadDay) =>
    `${DAY_LONG.format(toDate(entry.day))}: ${EXACT.format(entry.downloads)} downloads`;

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - box.left) / box.width) * WIDTH;
    const index = step ? Math.round((svgX - MARGIN.left) / step) : 0;
    setActive(Math.min(last, Math.max(0, index)));
  };

  const onDayChange = (event: ChangeEvent<HTMLInputElement>) =>
    setActive(Number(event.target.value));

  return (
    <figure className="flex flex-col gap-3">
      {/* Below 640px the chart scrolls sideways instead of shrinking its labels. */}
      <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
        <div className="has-focus-visible:ring-ring/50 relative min-w-160 rounded-lg has-focus-visible:ring-2">
          {/* Arrow keys move a native slider through the days; the chart follows it. */}
          <input
            aria-label="Day"
            aria-valuetext={activeEntry ? describe(activeEntry) : undefined}
            className="peer sr-only"
            max={last}
            min={0}
            onBlur={() => setActive(null)}
            onChange={onDayChange}
            onFocus={() => setActive(active ?? last)}
            type="range"
            value={active ?? last}
          />
          <svg
            aria-hidden="true"
            className="block h-auto w-full touch-pan-y overflow-visible"
            onPointerLeave={() => setActive(null)}
            onPointerMove={onPointerMove}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--stats-series)"
                  stopOpacity="0.28"
                />
                <stop
                  offset="100%"
                  stopColor="var(--stats-series)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            {Array.from({ length: GRID_LINES + 1 }, (_, gridLine) => {
              const value = (max * gridLine) / GRID_LINES;
              return (
                <g key={gridLine}>
                  <line
                    className="stroke-border"
                    strokeDasharray={gridLine === 0 ? undefined : "3 5"}
                    x1={MARGIN.left}
                    x2={WIDTH - MARGIN.right}
                    y1={y(value)}
                    y2={y(value)}
                  />
                  <text
                    className="fill-muted-foreground text-eyebrow tabular-nums"
                    dominantBaseline="middle"
                    textAnchor="end"
                    x={MARGIN.left - 10}
                    y={y(value)}
                  >
                    {COMPACT.format(value)}
                  </text>
                </g>
              );
            })}
            {tickIndexes(data.length).map((index) => (
              <text
                className="fill-muted-foreground text-eyebrow"
                key={index}
                textAnchor={tickAnchor(index, last)}
                x={x(index)}
                y={HEIGHT - 10}
              >
                {data[index] ? DAY_LABEL.format(toDate(data[index].day)) : ""}
              </text>
            ))}
            <path d={area} fill={`url(#${gradientId})`} />
            <path
              d={line}
              fill="none"
              stroke="var(--stats-series)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
            {activeEntry && active !== null ? (
              <g>
                <line
                  className="stroke-muted-foreground"
                  strokeDasharray="3 3"
                  x1={x(active)}
                  x2={x(active)}
                  y1={MARGIN.top}
                  y2={baseline}
                />
                <circle
                  className="stroke-background"
                  cx={x(active)}
                  cy={y(activeEntry.downloads)}
                  fill="var(--stats-series)"
                  r={MARKER_RADIUS}
                  strokeWidth={2}
                />
              </g>
            ) : null}
          </svg>
          {activeEntry && active !== null ? (
            <div
              aria-hidden="true"
              className={cn(
                "bg-popover text-popover-foreground border-border pointer-events-none absolute top-0 left-(--tooltip-x) flex flex-col gap-0.5 rounded-md border px-3 py-2 text-xs whitespace-nowrap shadow-md",
                active > data.length / 2 ? "-ml-3 -translate-x-full" : "ml-3"
              )}
              style={
                {
                  "--tooltip-x": `${(x(active) / WIDTH) * 100}%`,
                } as CSSProperties
              }
            >
              <span className="text-muted-foreground">
                {DAY_LONG.format(toDate(activeEntry.day))}
              </span>
              <span className="font-medium tabular-nums">
                {EXACT.format(activeEntry.downloads)} downloads
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <details className="text-sm">
        <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer">
          Show as a table
        </summary>
        <div className="mt-3 max-h-72 overflow-y-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 font-normal" scope="col">
                  Day
                </th>
                <th className="py-1 text-right font-normal" scope="col">
                  Downloads
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => (
                <tr className="border-divider border-t" key={entry.day}>
                  <td className="py-1">{DAY_LONG.format(toDate(entry.day))}</td>
                  <td className="py-1 text-right">
                    {EXACT.format(entry.downloads)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
};
