import { OgDocsCard } from "@/components/og/og-card";
import { getNpmStats } from "@/lib/npm-stats";
import { renderOgImage } from "@/lib/og";
import { siteHost } from "@/lib/seo";

export const alt = "Copybook stats: npm downloads and releases";
export const contentType = "image/png";
export { ogImageSize as size } from "@/lib/shared";

// The same refresh as the page, so a shared card never cites older numbers.
export const revalidate = 3600;

const COMPACT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});

/** The card's line of numbers, or a plain description when npm is down. */
const describe = (stats: Awaited<ReturnType<typeof getNpmStats>>) => {
  const [core] = stats?.packages ?? [];
  if (!(stats && core)) {
    return "npm downloads, releases, and GitHub stars.";
  }
  const parts = [`${COMPACT.format(stats.totalDownloads)} downloads`];
  if (stats.lastWeekDownloads !== null) {
    parts.push(`${COMPACT.format(stats.lastWeekDownloads)} in the last 7 days`);
  }
  if (core.latestVersion) {
    parts.push(`v${core.latestVersion} latest`);
  }
  return parts.join(" · ");
};

const Image = async () =>
  renderOgImage(
    <OgDocsCard
      description={describe(await getNpmStats())}
      path={`${siteHost}/stats`}
      section="Stats"
      title="Copybook by the numbers"
    />
  );

export default Image;
