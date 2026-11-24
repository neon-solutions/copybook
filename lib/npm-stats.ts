/*
 * Public npm numbers for Copybook's packages, for the /stats page. Every
 * request is cached for an hour, and any failure degrades to `null`, so an
 * npm outage empties the page's numbers instead of taking the page down.
 */

const DOWNLOADS_ORIGIN = "https://api.npmjs.org";
const REGISTRY_ORIGIN = "https://registry.npmjs.org";
export const STATS_PACKAGES = ["@copybook/core", "@copybook/cli"] as const;
export const STATS_REVALIDATE_SECONDS = 3600;
const REQUEST_TIMEOUT_MS = 5000;
/** npm serves at most 18 months of daily downloads in one range request. */
const MAX_RANGE_DAYS = 540;
const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/u;
const PRERELEASE = /-/u;

export interface DownloadDay {
  day: string;
  downloads: number;
}

export interface PackageStats {
  lastWeekDownloads: number | null;
  latestVersion: string | null;
  name: string;
  totalDownloads: number;
  versionCount: number;
}

export interface NpmStats {
  /** Both packages' downloads per day, from the first release to the last settled day. */
  daily: DownloadDay[];
  firstPublishedDay: string;
  lastWeekDownloads: number | null;
  packages: PackageStats[];
  totalDownloads: number;
}

interface RegistryMetadata {
  firstPublishedDay: string;
  latestVersion: string | null;
  versionCount: number;
}

const toIsoDay = (date: Date) => date.toISOString().slice(0, 10);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isIsoDay = (value: unknown): value is string =>
  typeof value === "string" && ISO_DAY.test(value);

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** The registry and the downloads API both want the scope's slash encoded. */
const encodeName = (name: string) => name.replace("/", "%2F");

const fetchJson = async (url: string): Promise<unknown> => {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: STATS_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
};

/** The registry's `time` map is the only record of when each version shipped. */
export const parseRegistryMetadata = (
  payload: unknown
): RegistryMetadata | null => {
  if (!(isRecord(payload) && isRecord(payload.time))) {
    return null;
  }
  const { created } = payload.time;
  if (typeof created !== "string" || !isIsoDay(created.slice(0, 10))) {
    return null;
  }
  const versions = Object.keys(payload.time).filter(
    (key) => key !== "created" && key !== "modified"
  );
  const distTags = isRecord(payload["dist-tags"]) ? payload["dist-tags"] : {};
  const { latest } = distTags;
  return {
    firstPublishedDay: created.slice(0, 10),
    latestVersion: typeof latest === "string" ? latest : null,
    versionCount: versions.filter((version) => !PRERELEASE.test(version))
      .length,
  };
};

export const parseDownloadRange = (payload: unknown): DownloadDay[] | null => {
  if (!(isRecord(payload) && Array.isArray(payload.downloads))) {
    return null;
  }
  const days: DownloadDay[] = [];
  for (const entry of payload.downloads) {
    if (!(isRecord(entry) && isIsoDay(entry.day) && isCount(entry.downloads))) {
      return null;
    }
    days.push({ day: entry.day, downloads: entry.downloads });
  }
  return days;
};

const parseDownloadPoint = (payload: unknown): number | null =>
  isRecord(payload) && isCount(payload.downloads) ? payload.downloads : null;

/**
 * npm fills in a day's total some hours after it closes, and reports an
 * unsettled day as 0, which would draw a cliff at the right edge. Trailing
 * zeros are dropped; zeros between real days are quiet days and stay.
 */
export const dropUnsettledDays = (days: readonly DownloadDay[]) => {
  let end = days.length;
  while (end > 0 && days[end - 1]?.downloads === 0) {
    end -= 1;
  }
  return end === 0 ? [...days] : days.slice(0, end);
};

/** Adds the packages' downloads day by day. */
export const sumByDay = (series: readonly (readonly DownloadDay[])[]) => {
  const totals = new Map<string, number>();
  for (const days of series) {
    for (const { day, downloads } of days) {
      totals.set(day, (totals.get(day) ?? 0) + downloads);
    }
  }
  return [...totals]
    .map(([day, downloads]) => ({ day, downloads }))
    .toSorted((left, right) => left.day.localeCompare(right.day));
};

const clampRangeStart = (startDay: string, endDay: string) => {
  const earliest =
    new Date(`${endDay}T00:00:00Z`).getTime() - MAX_RANGE_DAYS * DAY_MS;
  return new Date(`${startDay}T00:00:00Z`).getTime() < earliest
    ? toIsoDay(new Date(earliest))
    : startDay;
};

const fetchPackage = async (name: string, endDay: string) => {
  const encoded = encodeName(name);
  const registry = parseRegistryMetadata(
    await fetchJson(`${REGISTRY_ORIGIN}/${encoded}`)
  );
  if (!registry) {
    return null;
  }
  const startDay = clampRangeStart(registry.firstPublishedDay, endDay);
  const [range, lastWeek] = await Promise.all([
    fetchJson(
      `${DOWNLOADS_ORIGIN}/downloads/range/${startDay}:${endDay}/${encoded}`
    ),
    fetchJson(`${DOWNLOADS_ORIGIN}/downloads/point/last-week/${encoded}`),
  ]);
  const daily = parseDownloadRange(range) ?? [];
  return {
    daily,
    registry,
    stats: {
      lastWeekDownloads: parseDownloadPoint(lastWeek),
      latestVersion: registry.latestVersion,
      name,
      totalDownloads: daily.reduce((sum, day) => sum + day.downloads, 0),
      versionCount: registry.versionCount,
    } satisfies PackageStats,
  };
};

/**
 * Downloads and releases for every package in `STATS_PACKAGES`, or `null`
 * when npm doesn't answer for any of them. Counts include CI and mirrors, so
 * they measure downloads, not people.
 */
export const getNpmStats = async (
  now = Date.now()
): Promise<NpmStats | null> => {
  // Today is always partial, so the range ends yesterday.
  const endDay = toIsoDay(new Date(now - DAY_MS));
  const results = await Promise.all(
    STATS_PACKAGES.map((name) => fetchPackage(name, endDay))
  );
  const packages = results.filter((result) => result !== null);
  if (packages.length !== results.length) {
    return null;
  }
  const weekly = packages.map((result) => result.stats.lastWeekDownloads);
  return {
    daily: dropUnsettledDays(sumByDay(packages.map((result) => result.daily))),
    firstPublishedDay: packages
      .map((result) => result.registry.firstPublishedDay)
      .toSorted()[0] as string,
    lastWeekDownloads: weekly.includes(null)
      ? null
      : weekly.reduce<number>((sum, count) => sum + (count ?? 0), 0),
    packages: packages.map((result) => result.stats),
    totalDownloads: packages.reduce(
      (sum, result) => sum + result.stats.totalDownloads,
      0
    ),
  };
};
