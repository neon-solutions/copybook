import { BIN_NAME } from "./meta";
import { detectPackageManager } from "./package-manager";
import type { Results } from "./results";
import type { Issue, IssueCode } from "./validate";

/**
 * Something to do next, for people and agents. `argv` is the CLI command
 * without the runner, and `tool` the matching MCP tool, when one exists.
 */
export interface NextAction {
  argv?: string[];
  code: string;
  /** The command to show, such as `copybook snapshot`. */
  command?: string;
  ids?: string[];
  /** Whether an agent can do it without asking. */
  safe: boolean;
  title: string;
  tool?: string;
}

/** How to run the CLI in a project, such as `pnpm exec copybook`. */
export const runnerFor = (root: string) => {
  const runners = {
    bun: `bunx ${BIN_NAME}`,
    npm: `npx ${BIN_NAME}`,
    pnpm: `pnpm exec ${BIN_NAME}`,
    yarn: `yarn ${BIN_NAME}`,
  } as const;
  return runners[detectPackageManager(root)];
};

const cli = (argv: string[]) => ({
  argv,
  command: [BIN_NAME, ...argv].join(" "),
});

const idsWith = (issues: readonly Issue[], codes: readonly IssueCode[]) => [
  ...new Set(
    issues.flatMap((issue) =>
      issue.id !== undefined && codes.includes(issue.code) ? [issue.id] : []
    )
  ),
];

const FIX_CODES: readonly IssueCode[] = [
  "alias-conflict",
  "nondeterministic",
  "render-failed",
  "unknown-placement",
];

/**
 * What to do about `issues`, and about the latest test and eval results,
 * in the order to do it: fix definitions first, then snapshots, then tests.
 */
export const nextActions = (
  issues: readonly Issue[],
  results?: Results
): NextAction[] => {
  const actions: NextAction[] = [];

  const broken = idsWith(issues, FIX_CODES);
  if (broken.length > 0) {
    actions.push({
      code: "fix-definitions",
      ids: broken,
      safe: true,
      title:
        "Fix the definitions with errors: render failures, impure templates, alias conflicts, or undeclared placements.",
      tool: "get_definition",
    });
  }

  const stale = idsWith(issues, ["snapshot-missing", "snapshot-changed"]);
  if (stale.length > 0) {
    actions.push({
      ...cli(["snapshot"]),
      code: "write-snapshots",
      ids: stale,
      safe: true,
      title:
        "Write the missing and changed snapshots, then review and commit them.",
      tool: "write_snapshots",
    });
  }

  const orphaned = idsWith(issues, ["snapshot-orphaned"]);
  if (orphaned.length > 0) {
    actions.push({
      ...cli(["snapshot", "--prune"]),
      code: "prune-snapshots",
      ids: orphaned,
      safe: false,
      title:
        "Delete the snapshots whose definitions are gone. If one was renamed, add the old id to its aliases instead.",
      tool: "prune_snapshots",
    });
  }

  const removed = idsWith(issues, ["removed-without-alias"]);
  if (removed.length > 0) {
    actions.push({
      code: "add-aliases",
      ids: removed,
      safe: true,
      title:
        "Add each removed id to the aliases of the definition that replaced it, so history and results carry over.",
    });
  }

  const unused = idsWith(issues, ["unused"]);
  if (unused.length > 0) {
    actions.push({
      code: "review-unused",
      ids: unused,
      safe: false,
      title:
        "Render these definitions in the product, or ask before removing them.",
    });
  }

  if (results) {
    const failing = [
      ...new Set(
        (results.test?.results ?? [])
          .filter((result) => result.status === "fail")
          .map((result) => result.id)
      ),
    ];
    if (failing.length > 0) {
      actions.push({
        ...cli(["test", "--only", ...failing]),
        code: "fix-tests",
        ids: failing,
        safe: true,
        title: "Fix the failing commands and snippets, then rerun their tests.",
        tool: "run_tests",
      });
    } else if (!results.test) {
      actions.push({
        ...cli(["test"]),
        code: "run-tests",
        safe: true,
        title: "Run the syntax and typecheck tests.",
        tool: "run_tests",
      });
    }
    const failingEvals = [
      ...new Set(
        (results.eval?.results ?? [])
          .filter((result) => result.status === "fail")
          .map((result) => result.id)
      ),
    ];
    if (failingEvals.length > 0) {
      actions.push({
        code: "review-evals",
        ids: failingEvals,
        safe: true,
        title:
          "Read the failing evals' transcripts in .copybook/results/evals, then improve the prompts. Evals run in CI.",
      });
    }
  }

  return actions;
};

/** Next actions as lines for the terminal. */
export const formatNextActions = (actions: readonly NextAction[]) =>
  actions.map(
    (action) =>
      `Next: ${action.command ? `\`${action.command}\` ` : ""}${action.command ? `(${action.title})` : action.title}`
  );
