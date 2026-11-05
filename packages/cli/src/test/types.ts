import type { Definition, Deps } from "@copybook/core";

import type { TestSpec, Tier } from "./define";

export interface TestCase {
  definition: Definition;
  deps?: Deps;
  id: string;
  /**
   * For example `framework=python`, or `cmd 2` and `code block 1` for a
   * literal command and shell code block in a prompt.
   */
  label?: string;
  lang?: string;
  /** Set to skip the case, with the reason. */
  skip?: string;
  spec?: TestSpec;
  /** A literal command or shell code block in a prompt, tested by text. */
  text?: string;
  tier: Tier;
  /** The snippet variant key. */
  variant?: string;
}

export type TestStatus = "fail" | "pass" | "skip";

export interface TestResult {
  durationMs: number;
  id: string;
  label?: string;
  message?: string;
  status: TestStatus;
  tier: Tier;
  variant?: string;
}

export interface TestReport {
  finishedAt: string;
  results: TestResult[];
  runId: string;
  startedAt: string;
  tiers: Tier[];
}
