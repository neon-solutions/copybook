import { useEffect, useState } from "react";

import { fetchHistory } from "./api";
import type { Commit } from "./types";

const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export const History = ({ id, loadedAt }: { id: string; loadedAt: string }) => {
  const [commits, setCommits] = useState<Commit[] | undefined>();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await fetchHistory(id, loadedAt).catch(() => []);
      if (!cancelled) {
        setCommits(result);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id, loadedAt]);

  if (!commits) {
    return <p className="text-muted-foreground text-sm">Loading history…</p>;
  }
  if (commits.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        The snapshot isn&apos;t committed yet.
      </p>
    );
  }
  return (
    <ol className="flex flex-col divide-y border">
      {commits.map((commit) => (
        <li
          className="flex flex-col gap-0.5 px-3 py-2 text-sm"
          key={commit.hash}
        >
          <span>{commit.subject}</span>
          <span className="text-muted-foreground text-xs">
            <code>{commit.hash.slice(0, 7)}</code> · {commit.author} ·{" "}
            <time dateTime={commit.date}>
              {formatter.format(new Date(commit.date))}
            </time>
          </span>
        </li>
      ))}
    </ol>
  );
};
