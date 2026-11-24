import type { Metadata } from "next";

import { DownloadsChart } from "@/components/stats/downloads-chart";
import { getStargazersCount } from "@/lib/github";
import { getNpmStats, STATS_PACKAGES } from "@/lib/npm-stats";
import { siteConfig } from "@/lib/shared";
import registry from "@/registry.json";

// npm and GitHub are asked again at most once an hour.
export const revalidate = 3600;

const TITLE = "Stats";
const DESCRIPTION =
  "npm downloads, releases, and GitHub stars for @copybook/core and @copybook/cli, from the public npm registry.";

// A segment's openGraph replaces the root layout's, so repeat siteName.
export const metadata: Metadata = {
  alternates: { canonical: "/stats" },
  description: DESCRIPTION,
  openGraph: {
    description: DESCRIPTION,
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: `${siteConfig.name} ${TITLE.toLowerCase()}`,
    type: "website",
    url: "/stats",
  },
  title: TITLE,
};

const COMPACT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});
const EXACT = new Intl.NumberFormat("en-US");
const DAY_LONG = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

const compact = (value: number | null) =>
  value === null ? "—" : COMPACT.format(value);
const exact = (value: number | null) =>
  value === null ? undefined : EXACT.format(value);

const StatTile = ({
  detail,
  label,
  title,
  value,
}: {
  detail?: string;
  label: string;
  title?: string;
  value: string;
}) => (
  <div className="border-border flex flex-col gap-1 rounded-lg border p-4">
    <dt className="text-muted-foreground text-sm">{label}</dt>
    <dd className="text-2xl font-medium tabular-nums" title={title}>
      {value}
    </dd>
    {detail ? (
      <dd className="text-muted-foreground text-xs">{detail}</dd>
    ) : null}
  </div>
);

const Unavailable = () => (
  <p className="border-border text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
    Download stats are unavailable right now because the npm registry
    didn&apos;t answer. They come back on the page&apos;s next hourly refresh.
  </p>
);

const SectionHeading = ({
  children,
  description,
}: {
  children: string;
  description: string;
}) => (
  <div className="flex flex-col gap-1">
    <h2 className="text-xl font-medium tracking-tight">{children}</h2>
    <p className="text-muted-foreground text-sm">{description}</p>
  </div>
);

const StatsPage = async () => {
  const [stats, stars] = await Promise.all([
    getNpmStats(),
    getStargazersCount(),
  ]);
  const [core] = stats?.packages ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-6 pt-32 pb-16 md:pt-40">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-medium tracking-tight">{TITLE}</h1>
        <p className="text-muted-foreground max-w-2xl">
          Public usage numbers for{" "}
          {STATS_PACKAGES.map((name, index) => (
            <span key={name}>
              {index > 0 ? " and " : null}
              <code className="bg-muted rounded px-1.5 py-0.5 text-sm">
                {name}
              </code>
            </span>
          ))}
          , from the npm registry. Download counts include continuous
          integration and mirrors, so they measure downloads, not people.
        </p>
      </header>

      {stats ? (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="sr-only">Summary</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatTile
                detail={`since ${DAY_LONG.format(new Date(`${stats.firstPublishedDay}T00:00:00Z`))}`}
                label="Downloads"
                title={exact(stats.totalDownloads)}
                value={compact(stats.totalDownloads)}
              />
              <StatTile
                detail="last 7 days"
                label="Recent"
                title={exact(stats.lastWeekDownloads)}
                value={compact(stats.lastWeekDownloads)}
              />
              <StatTile label="Latest" value={core?.latestVersion ?? "—"} />
              <StatTile
                detail="stable releases"
                label="Versions"
                value={core ? EXACT.format(core.versionCount) : "—"}
              />
              <StatTile
                detail="in the registry"
                label="Components"
                value={EXACT.format(registry.items.length)}
              />
              <StatTile
                label="Stars"
                title={exact(stars)}
                value={compact(stars)}
              />
            </dl>
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeading description="Both packages, every settled day since the first release. npm fills in a day's total some hours after it ends, so the last day or two arrive late.">
              Downloads per day
            </SectionHeading>
            {stats.daily.length > 0 ? (
              <DownloadsChart data={stats.daily} />
            ) : (
              <Unavailable />
            )}
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeading description="Each package's latest release and downloads.">
              By package
            </SectionHeading>
            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm tabular-nums">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th
                      className="px-4 py-2 font-normal whitespace-nowrap"
                      scope="col"
                    >
                      Package
                    </th>
                    <th
                      className="px-4 py-2 font-normal whitespace-nowrap"
                      scope="col"
                    >
                      Latest
                    </th>
                    <th
                      className="px-4 py-2 text-right font-normal whitespace-nowrap"
                      scope="col"
                    >
                      Last 7 days
                    </th>
                    <th
                      className="px-4 py-2 text-right font-normal whitespace-nowrap"
                      scope="col"
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.packages.map((pkg) => (
                    <tr className="border-border border-t" key={pkg.name}>
                      <th
                        className="px-4 py-2 font-mono font-normal"
                        scope="row"
                      >
                        <a
                          className="hover:underline"
                          href={`https://www.npmjs.com/package/${pkg.name}`}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {pkg.name}
                        </a>
                      </th>
                      <td className="px-4 py-2">{pkg.latestVersion ?? "—"}</td>
                      <td className="px-4 py-2 text-right">
                        {exact(pkg.lastWeekDownloads) ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {EXACT.format(pkg.totalDownloads)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <Unavailable />
      )}
    </div>
  );
};

export default StatsPage;
