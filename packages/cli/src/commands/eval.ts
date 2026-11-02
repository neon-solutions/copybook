import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";

import type { Command } from "commander";

import { changedIds } from "../changes";
import { CopybookError } from "../errors";
import { appendHistory } from "../eval/history";
import { formatEvalResult, summarizeEvals } from "../eval/reporters";
import { runEvals } from "../eval/runner";
import type { EvalTarget } from "../eval/runner";
import { loadProject } from "../load";
import { formatNextActions, nextActions } from "../next-actions";
import {
  colors as pc,
  cwd,
  env,
  setExitCode,
  write,
  writeError,
  writeJson,
} from "../output";
import { writeResults } from "../results";
import { loadEvalSpecs } from "../test/load";
import { buildSnapshots } from "../validate";

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

const gitSha = async (root: string) => {
  const result = await promisify(execFile)("git", ["rev-parse", "HEAD"], {
    cwd: root,
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
      if (env().CI !== "true" && !options.unsafeLocal) {
        throw new CopybookError("EVAL_OUTSIDE_CI", UNSAFE_MESSAGE);
      }
      const project = await loadProject(cwd(), options);
      const specs = await loadEvalSpecs(project.config);
      const { snapshots } = buildSnapshots(project);
      const hashes = new Map(
        snapshots.map((snapshot) => [snapshot.id, snapshot.hash])
      );
      const changed = options.changed
        ? new Set(await changedIds(project, snapshots, options.base))
        : undefined;
      const only = options.only ? new Set(options.only) : undefined;
      const warnings = (options.only ?? [])
        .filter((id) => !specs.some((spec) => spec.id === id))
        .map((id) => `No eval for "${id}".`);

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

      await writeResults(project.config.root, "eval", report);
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

      const failed = report.results.some((result) => result.status === "fail");
      if (failed) {
        setExitCode(1);
      }
      const next = nextActions([], { eval: report });
      if (options.json) {
        writeJson({
          ...report,
          next,
          ok: !failed,
          schemaVersion: 1,
          warnings,
        });
        return;
      }
      for (const warning of warnings) {
        writeError(`${pc.yellow("warning")} ${warning}`);
      }
      write(
        `\n${targets.length === 0 ? pc.dim("No evals selected.") : summarizeEvals(report)}`
      );
      for (const line of formatNextActions(next)) {
        writeError(line);
      }
    });
