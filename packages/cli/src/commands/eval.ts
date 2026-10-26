import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { Command } from "commander";
import pc from "picocolors";

import { changedIds } from "../changes";
import { appendHistory } from "../eval/history";
import { formatEvalResult, summarizeEvals } from "../eval/reporters";
import { runEvals } from "../eval/runner";
import type { EvalTarget } from "../eval/runner";
import { loadProject } from "../load";
import { write, writeError } from "../output";
import { loadEvalSpecs } from "../test/load";
import { buildSnapshots } from "../validate";
import { RESULTS_DIR } from "./test";

interface EvalCommandOptions {
  agent?: string[];
  base: string;
  budgetUsd?: string;
  changed?: boolean;
  config?: string;
  force?: boolean;
  historyDir?: string;
  json?: boolean;
  only?: string[];
  trials?: string;
  unsafeLocal?: boolean;
}

const gitSha = async (cwd: string) => {
  const result = await promisify(execFile)("git", ["rev-parse", "HEAD"], {
    cwd,
  }).catch(() => null);
  return result?.stdout.trim();
};

const UNSAFE_MESSAGE = `Evals give coding agents full permissions in a sandbox directory, which isn't isolated from your machine.
Run them in CI (CI=true), or pass --unsafe-local if you accept that.`;

export const registerEval = (program: Command) =>
  program
    .command("eval")
    .description("Give prompts to coding agents and check what they did.")
    .option("--only <ids...>", "only these prompt ids")
    .option("--agent <names...>", "only these agents")
    .option("--trials <n>", "override each eval's trial count")
    .option(
      "--budget-usd <amount>",
      "stop starting trials after spending this much"
    )
    .option("--changed", "only prompts whose output changed since --base")
    .option("--base <ref>", "the git ref to compare against", "HEAD")
    .option(
      "--history-dir <dir>",
      "append results to <dir>/<id>.jsonl, and skip prompts already evaluated"
    )
    .option("--force", "re-run prompts that history says are unchanged")
    .option("--json", "print the report as JSON")
    .option("--unsafe-local", "allow running outside CI")
    .option("-c, --config <path>", "the config file")
    .action(async (options: EvalCommandOptions) => {
      if (process.env.CI !== "true" && !options.unsafeLocal) {
        writeError(UNSAFE_MESSAGE);
        process.exitCode = 1;
        return;
      }
      const project = await loadProject(process.cwd(), options);
      const specs = await loadEvalSpecs(project.config);
      const { snapshots } = buildSnapshots(project);
      const hashes = new Map(
        snapshots.map((snapshot) => [snapshot.id, snapshot.hash])
      );
      const changed = options.changed
        ? new Set(await changedIds(project, snapshots, options.base))
        : undefined;
      const only = options.only ? new Set(options.only) : undefined;

      const targets: EvalTarget[] = specs.flatMap((spec) => {
        const loaded = project.definitions.find(
          ({ definition }) => definition.id === spec.id
        );
        const selected =
          (!only || only.has(spec.id)) && (!changed || changed.has(spec.id));
        if (!loaded || !selected) {
          return [];
        }
        return [
          {
            contentHash: hashes.get(spec.id) ?? "",
            definition: loaded.definition,
            spec,
          },
        ];
      });

      const runId = randomBytes(4).toString("hex");
      const historyDir = options.historyDir
        ? path.resolve(options.historyDir)
        : undefined;
      const report = await runEvals(targets, {
        ...(options.agent ? { agents: options.agent } : {}),
        ...(options.budgetUsd ? { budgetUsd: Number(options.budgetUsd) } : {}),
        ...(options.force ? { force: true } : {}),
        ...(historyDir ? { historyDir } : {}),
        ...(options.json
          ? {}
          : { onResult: (result) => write(formatEvalResult(result)) }),
        ...(options.trials ? { trials: Number(options.trials) } : {}),
        root: project.config.root,
        runId,
      });

      const resultsDir = path.join(project.config.root, RESULTS_DIR);
      await mkdir(resultsDir, { recursive: true });
      await writeFile(
        path.join(resultsDir, "eval.json"),
        JSON.stringify(report, null, 2)
      );
      if (historyDir) {
        const sha = await gitSha(project.config.root);
        const finished = report.results.filter(
          (result) => result.status === "pass" || result.status === "fail"
        );
        await Promise.all(
          finished.map((result) =>
            appendHistory(historyDir, result, {
              date: report.finishedAt,
              runId,
              ...(sha ? { gitSha: sha } : {}),
            })
          )
        );
      }

      if (options.json) {
        write(JSON.stringify(report, null, 2));
      } else {
        write(
          `\n${targets.length === 0 ? pc.dim("No evals selected.") : summarizeEvals(report)}`
        );
      }
      if (report.results.some((result) => result.status === "fail")) {
        process.exitCode = 1;
      }
    });
