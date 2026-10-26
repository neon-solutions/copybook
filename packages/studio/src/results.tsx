import { useEffect, useState } from "react";

import { fetchResults } from "./api";
import type { Results } from "./types";

const STATUS_CLASSES = {
  cached: "text-muted-foreground",
  fail: "text-destructive",
  pass: "text-primary",
  skip: "text-muted-foreground",
} as const;

const useResults = (loadedAt: string) => {
  const [results, setResults] = useState<Results | undefined>();
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = await fetchResults(loadedAt).catch(() => ({}));
      if (!cancelled) {
        setResults(next);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [loadedAt]);
  return results;
};

const percent = (rate: number) => `${Math.round(rate * 100)}%`;

export const TestResults = ({
  id,
  loadedAt,
}: {
  id: string;
  loadedAt: string;
}) => {
  const results = useResults(loadedAt);
  const tests =
    results?.test?.results.filter((result) => result.id === id) ?? [];
  const evals =
    results?.eval?.results.filter((result) => result.id === id) ?? [];

  if (tests.length === 0 && evals.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No results yet. Run <code>prompt-manager test</code> or{" "}
        <code>prompt-manager eval</code>.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {tests.length > 0 ? (
        <ul className="flex flex-col divide-y border">
          {tests.map((result) => (
            <li
              className="flex flex-col gap-0.5 px-3 py-2 text-sm"
              key={`${result.tier}-${result.variant ?? result.label ?? ""}`}
            >
              <span>
                <span className={STATUS_CLASSES[result.status]}>
                  {result.status}
                </span>{" "}
                <span className="text-muted-foreground">{result.tier}</span>{" "}
                <code>{result.variant ?? result.label ?? ""}</code>
              </span>
              {result.message ? (
                <pre className="text-muted-foreground text-xs whitespace-pre-wrap">
                  {result.message}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {evals.length > 0 ? (
        <ul className="flex flex-col divide-y border">
          {evals.map((result) => (
            <li
              className="flex flex-col gap-0.5 px-3 py-2 text-sm"
              key={result.agent}
            >
              <span>
                <span className={STATUS_CLASSES[result.status]}>
                  {result.status}
                </span>{" "}
                {result.agent}{" "}
                <span className="text-muted-foreground">
                  {result.agentVersion} · {percent(result.passRate)} of{" "}
                  {result.trials.length || "-"} trials (needs{" "}
                  {percent(result.threshold)})
                  {result.costUsd > 0 ? ` · $${result.costUsd.toFixed(2)}` : ""}
                </span>
              </span>
              {result.reason ? (
                <span className="text-muted-foreground text-xs">
                  {result.reason}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
