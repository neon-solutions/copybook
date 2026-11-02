import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";
import type { ReactElement } from "react";

import { ogImageSize } from "./shared";

const readFont = (file: string) =>
  readFile(path.join(process.cwd(), "assets/fonts", file));

/*
 * Inter is the landing page's font, and Geist Mono its eyebrows and meta
 * strips. Satori takes TTF, not the WOFF2 that next/font serves, so Latin
 * subsets are committed in assets/fonts. They're read once per build.
 */
const fonts = Promise.all([
  readFont("Inter-Regular.ttf"),
  readFont("Inter-Medium.ttf"),
  readFont("GeistMono-Regular.ttf"),
]).then(([interRegular, interMedium, geistMono]) => [
  { data: interRegular, name: "Inter", weight: 400 as const },
  { data: interMedium, name: "Inter", weight: 500 as const },
  { data: geistMono, name: "Geist Mono", weight: 400 as const },
]);

export const renderOgImage = async (element: ReactElement) =>
  new ImageResponse(element, { ...ogImageSize, fonts: await fonts });
