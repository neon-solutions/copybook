import { colors as pc } from "../output";
import type { EvalReport, EvalResult } from "./types";

const ICONS = {
  cached: pc.dim("="),
  fail: pc.red("✗"),
  pass: pc.green("✓"),
  skip: pc.dim("○"),
} as const;

const percent = (rate: number) => `${Math.round(rate * 100)}%`;

export const formatEvalResult = (result: EvalResult) => {
  const cost = result.costUsd > 0 ? ` · $${result.costUsd.toFixed(2)}` : "";
  const header = `${ICONS[result.status]} ${result.id} ${pc.dim(`${result.agent} ${result.agentVersion}`)} ${percent(result.passRate)} ${pc.dim(`of ${result.trials.length || "-"} trials, needs ${percent(result.threshold)}${cost}`)}`;
  const lines = [header];
  if (result.reason) {
    lines.push(pc.dim(`    ${result.reason}`));
  }
  for (const trial of result.trials) {
    const failed = trial.assertions.filter((assertion) => !assertion.passed);
    if (trial.passed) {
      continue;
    }
    lines.push(
      pc.red(
        `    trial ${trial.trial}: ${trial.error ?? (trial.timedOut ? "agent timed out" : "")}`
      )
    );
    for (const assertion of failed) {
      lines.push(
        pc.red(
          `      ✗ ${assertion.name}${assertion.message ? `: ${assertion.message}` : ""}`
        )
      );
    }
  }
  return lines.join("\n");
};

export const summarizeEvals = (report: EvalReport) => {
  const count = (status: EvalResult["status"]) =>
    report.results.filter((result) => result.status === status).length;
  return [
    pc.green(`${count("pass")} passed`),
    count("fail") > 0 ? pc.red(`${count("fail")} failed`) : undefined,
    count("cached") > 0 ? pc.dim(`${count("cached")} cached`) : undefined,
    count("skip") > 0 ? pc.dim(`${count("skip")} skipped`) : undefined,
    pc.dim(`$${report.costUsd.toFixed(2)} spent`),
  ]
    .filter(Boolean)
    .join(", ");
};
