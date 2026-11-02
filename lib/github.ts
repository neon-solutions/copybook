import { gitConfig } from "@/lib/shared";

const REVALIDATE_SECONDS = 3600;

/**
 * The repository's star count, cached for an hour. `null` when GitHub
 * doesn't answer, for example when the API rate-limits the build.
 */
export const getStargazersCount = async (): Promise<number | null> => {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${gitConfig.user}/${gitConfig.repo}`,
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: REVALIDATE_SECONDS },
      }
    );
    if (!response.ok) {
      return null;
    }
    const { stargazers_count: count } = (await response.json()) as {
      stargazers_count?: unknown;
    };
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
};
