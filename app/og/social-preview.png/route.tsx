import { OgHomeCard } from "@/components/og/og-card";
import { renderOgImage } from "@/lib/og";

/**
 * GitHub's social preview for the repository, at the 2:1 size it asks for.
 * GitHub has no API for it, so upload this file in the repository's
 * settings when the brand changes.
 */
const SIZE = { height: 640, width: 1280 } as const;

export const revalidate = false;

export const GET = () => renderOgImage(<OgHomeCard size={SIZE} />, SIZE);
