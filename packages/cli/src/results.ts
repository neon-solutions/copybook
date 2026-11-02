import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { EvalReport } from "./eval/types";
import type { TestReport } from "./test/types";

/** Where `test` and `eval` keep their latest reports. Gitignored. */
export const RESULTS_DIR = ".copybook/results";

export interface Results {
  eval?: EvalReport;
  test?: TestReport;
}

type ResultKind = keyof Results;

const resultsFile = (root: string, kind: ResultKind) =>
  path.join(root, RESULTS_DIR, `${kind}.json`);

const readReport = async <T>(file: string): Promise<T | undefined> => {
  try {
    return JSON.parse(await readFile(file, "utf-8")) as T;
  } catch {
    return undefined;
  }
};

/** The latest `test` and `eval` reports, when they exist. */
export const readResults = async (root: string): Promise<Results> => {
  const [test, evaluation] = await Promise.all([
    readReport<TestReport>(resultsFile(root, "test")),
    readReport<EvalReport>(resultsFile(root, "eval")),
  ]);
  return {
    ...(evaluation ? { eval: evaluation } : {}),
    ...(test ? { test } : {}),
  };
};

export const writeResults = async <K extends ResultKind>(
  root: string,
  kind: K,
  report: NonNullable<Results[K]>
) => {
  await mkdir(path.join(root, RESULTS_DIR), { recursive: true });
  await writeFile(resultsFile(root, kind), JSON.stringify(report, null, 2));
};
