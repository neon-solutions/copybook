/*
 * The Neon Aurora as a still, for OG images. Satori can't run the WebGL
 * shader, so this lays out the same field with the same hash: blocks of
 * thin bars in five irregular rows, sparse solo stubs between them, and
 * the deep-to-primary-to-accent ramp. A mask keeps the bars off the copy,
 * like the hero's.
 */

import { ogImageSize } from "@/lib/shared";

type Rgb = readonly [number, number, number];

const DEEP: Rgb = [14, 95, 69];
const PRIMARY: Rgb = [0, 229, 153];
const ACCENT: Rgb = [59, 130, 246];

export interface ImageSize {
  height: number;
  width: number;
}

const COLUMNS = 110;
const ROWS = 5;
const BAR_WIDTH = 3;
/** Share of blocks that are lit. */
const DENSITY = 0.34;
/** Bars fainter than this aren't drawn. */
const MIN_ALPHA = 0.03;

/** The shader's hash, so the still has the hero's texture. */
const hash = (x: number, y: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43_758.5453;
  return value - Math.floor(value);
};

const smoothstep = (from: number, to: number, x: number) => {
  const t = Math.min(Math.max((x - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};

const mix = (from: Rgb, to: Rgb, t: number) =>
  from.map((channel, index) =>
    Math.round(channel + ((to[index] ?? channel) - channel) * t)
  );

/** Biased toward the luminous middle of the ramp, like the shader. */
const barColor = (column: number, row: number) => {
  const hue = 0.12 + 0.6 * hash(column * 1.3, row * 7.1);
  return hue < 0.5
    ? mix(DEEP, PRIMARY, hue * 2)
    : mix(PRIMARY, ACCENT, hue * 2 - 1);
};

export type AuroraLayout = "center" | "start";

/**
 * How lit the field is at a point, from 0 to 1 across the image each way:
 * clear around the copy, bright at the edges.
 */
const MASKS: Record<AuroraLayout, (x: number, y: number) => number> = {
  // The hero's mask: an ellipse cleared around centered copy.
  center: (x, y) =>
    smoothstep(0.7, 1, Math.hypot((x - 0.5) / 0.55, (y - 0.5) / 0.476)),
  // Copy on the left, so the bars gather on the right.
  start: (x) => smoothstep(0.6, 0.94, x),
};

interface Bar {
  color: string;
  height: number;
  key: string;
  left: number;
  top: number;
}

/** Each page gets its own pattern, the same on every build. */
const seedFrom = (text: string) => {
  let seed = 0;
  for (const char of text) {
    seed = (seed * 31 + (char.codePointAt(0) ?? 0)) % 9973;
  }
  return seed;
};

const layoutBars = (seed: number, layout: AuroraLayout, size: ImageSize) => {
  const mask = MASKS[layout];
  const period = size.width / COLUMNS;
  const bars: Bar[] = [];

  /** A bar centered at `center`, `half` tall each way, in fractions of the height. */
  const addBar = (
    column: number,
    row: number,
    center: number,
    half: number
  ) => {
    const left = column * period + (period - BAR_WIDTH) / 2;
    const breath = 0.55 + 0.45 * hash(column + seed, row);
    const alpha = breath * mask(left / size.width, center);
    if (alpha < MIN_ALPHA) {
      return;
    }
    const [red, green, blue] = barColor(column + seed, row);
    bars.push({
      color: `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`,
      height: half * 2 * size.height,
      key: `${row}-${column}-${bars.length}`,
      left,
      top: (center - half) * size.height,
    });
  };

  for (let row = 0; row < ROWS; row += 1) {
    // Blocks: runs of a few to a couple dozen bars, each with its own height.
    let column = 0;
    while (column < COLUMNS) {
      const width = 3 + Math.floor(hash(column + seed, row + 0.5) * 18);
      if (hash(column + seed, row * 7.7) < DENSITY) {
        const center =
          (row + 0.5) / ROWS + (hash(column, row * 1.9 + seed) - 0.5) * 0.12;
        const half = 0.03 + 0.11 * hash(column + seed, row * 2.3 + 5.1) ** 1.4;
        const end = Math.min(column + width, COLUMNS);
        for (let bar = column; bar < end; bar += 1) {
          addBar(bar, row, center, half * (0.85 + 0.3 * hash(bar, 3.3)));
        }
      }
      column += width;
    }

    // Solo bars: short loners between the blocks.
    for (let solo = 0; solo < COLUMNS; solo += 1) {
      if (hash(solo + seed, 91.3 + row) > 0.9) {
        const center =
          (row + 0.5) / ROWS + (hash(solo, 27.9 + row) - 0.5) * 0.16;
        addBar(solo, row, center, 0.012 + 0.05 * hash(solo, 14.2 + row) ** 2);
      }
    }
  }

  return bars;
};

export const OgAurora = ({
  layout,
  seed,
  size = ogImageSize,
}: {
  layout: AuroraLayout;
  seed: string;
  size?: ImageSize;
}) => (
  <div
    style={{
      display: "flex",
      height: "100%",
      left: 0,
      position: "absolute",
      top: 0,
      width: "100%",
    }}
  >
    {layoutBars(seedFrom(seed), layout, size).map((bar) => (
      <div
        key={bar.key}
        style={{
          backgroundColor: bar.color,
          borderRadius: 1,
          boxShadow: `0 0 8px ${bar.color}`,
          height: bar.height,
          left: bar.left,
          position: "absolute",
          top: bar.top,
          width: BAR_WIDTH,
        }}
      />
    ))}
  </div>
);
