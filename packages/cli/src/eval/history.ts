import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { EvalHistoryEntry, EvalResult } from "./types";

const historyFile = (dir: string, id: string) => path.join(dir, `${id}.jsonl`);

export const readHistory = async (
  dir: string,
  id: string
): Promise<EvalHistoryEntry[]> => {
  const file = historyFile(dir, id);
  if (!existsSync(file)) {
    return [];
  }
  const content = await readFile(file, "utf-8");
  const entries: EvalHistoryEntry[] = [];
  for (const line of content.split("\n")) {
    if (line.trim() === "") {
      continue;
    }
    try {
      entries.push(JSON.parse(line) as EvalHistoryEntry);
    } catch {
      // Best-effort history: skip corrupt lines instead of aborting the run.
    }
  }
  return entries;
};

/** The latest finished result for this exact prompt text and agent version. */
export const findCached = (
  history: readonly EvalHistoryEntry[],
  key: Pick<EvalResult, "agent" | "agentVersion" | "contentHash">
) =>
  history.findLast(
    (entry) =>
      entry.agent === key.agent &&
      entry.agentVersion === key.agentVersion &&
      entry.contentHash === key.contentHash &&
      (entry.status === "pass" || entry.status === "fail")
  );

export const appendHistory = async (
  dir: string,
  result: EvalResult,
  meta: { date: string; gitSha?: string; runId: string }
) => {
  await mkdir(dir, { recursive: true });
  const entry: EvalHistoryEntry = {
    agent: result.agent,
    agentVersion: result.agentVersion,
    contentHash: result.contentHash,
    costUsd: result.costUsd,
    date: meta.date,
    passRate: result.passRate,
    runId: meta.runId,
    status: result.status,
    trials: result.trials.length,
    ...(meta.gitSha ? { gitSha: meta.gitSha } : {}),
  };
  await appendFile(historyFile(dir, result.id), `${JSON.stringify(entry)}\n`);
};
