export interface AssertionOutcome {
  message?: string;
  name: string;
  passed: boolean;
}

export interface EvalTrial {
  agentExitCode: number | null;
  assertions: AssertionOutcome[];
  calls: string[];
  costUsd?: number;
  durationMs: number;
  error?: string;
  passed: boolean;
  timedOut: boolean;
  trial: number;
}

export type EvalStatus = "cached" | "fail" | "pass" | "skip";

export interface EvalResult {
  agent: string;
  agentVersion: string;
  contentHash: string;
  costUsd: number;
  id: string;
  passRate: number;
  reason?: string;
  status: EvalStatus;
  threshold: number;
  trials: EvalTrial[];
}

export interface EvalReport {
  costUsd: number;
  finishedAt: string;
  results: EvalResult[];
  runId: string;
  startedAt: string;
}

/** One line in `<history-dir>/<id>.jsonl`. */
export interface EvalHistoryEntry {
  agent: string;
  agentVersion: string;
  contentHash: string;
  costUsd: number;
  date: string;
  gitSha?: string;
  passRate: number;
  runId: string;
  status: EvalStatus;
  trials: number;
}
