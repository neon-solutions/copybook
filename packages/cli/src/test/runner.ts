import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { renderExample, toText } from "@copybook/core";
import type { AnyParam, Definition } from "@copybook/core";
import { transform } from "esbuild";

import type { Fixture, FixtureResult } from "./define";
import { exec, hasCommand } from "./exec";
import type { ExecResult } from "./exec";
import { caseDir, npmSandbox } from "./sandbox";
import { checkSyntax } from "./syntax";
import type { Check } from "./syntax";
import type { TestCase, TestReport, TestResult } from "./types";

const TYPECHECK_PACKAGES = ["typescript@^5", "@types/node@^24"];
const OUTPUT_TAIL_LINES = 30;

export interface RunOptions {
  concurrency: number;
  onResult?: (result: TestResult) => void;
  root: string;
  runId: string;
}

type Outcome = Check;

const secretParams = (definition: Definition) =>
  Object.entries(definition.params as Record<string, AnyParam>).filter(
    ([, param]) => param.state.kind === "secret"
  );

/** Secrets get stand-in values, so code never contains placeholder syntax. */
const standInSecrets = (definition: Definition) =>
  Object.fromEntries(
    secretParams(definition).map(([name]) => [name, `copybook_test_${name}`])
  );

const renderCode = (testCase: TestCase, values: Record<string, unknown>) =>
  testCase.text ??
  toText(
    renderExample(testCase.definition, {
      values,
      ...(testCase.variant ? { variant: testCase.variant } : {}),
    }),
    { format: "plain" }
  );

const tail = (text: string) =>
  text.trim().split("\n").slice(-OUTPUT_TAIL_LINES).join("\n");

const redact = (text: string, secrets: readonly string[]) => {
  let result = text;
  for (const secret of secrets) {
    if (secret !== "") {
      result = result.replaceAll(secret, "[redacted]");
    }
  }
  return result;
};

const failure = (result: ExecResult, what: string): Outcome => ({
  message: result.timedOut
    ? `${what} timed out`
    : `${what} exited with ${result.code}\n${tail(result.output)}`,
  status: "fail",
});

const typecheck = async (
  testCase: TestCase,
  root: string,
  code: string
): Promise<Outcome> => {
  const sandbox = await npmSandbox(root, [
    ...(testCase.deps?.npm ?? []),
    ...TYPECHECK_PACKAGES,
  ]);
  const dir = await caseDir(
    sandbox,
    `${testCase.id}-${testCase.variant ?? ""}`
  );
  const file = path.join(dir, "snippet.ts");
  // `export {}` makes the file a module, so top-level await is allowed.
  await writeFile(file, `${code}\nexport {};\n`);
  const result = await exec(
    path.join(sandbox, "node_modules", ".bin", "tsc"),
    [
      "--noEmit",
      "--strict",
      "--target",
      "es2022",
      "--module",
      "esnext",
      "--moduleResolution",
      "bundler",
      "--skipLibCheck",
      "--types",
      "node",
      "--lib",
      "es2022,dom",
      file,
    ],
    { cwd: dir }
  );
  return result.code === 0 ? { status: "pass" } : failure(result, "tsc");
};

let uvAvailable: Promise<boolean> | undefined;

interface RunContext {
  dir: string;
  env: Record<string, string>;
  timeoutMs?: number;
}

const execute = async (
  testCase: TestCase,
  code: string,
  context: RunContext
): Promise<ExecResult | Outcome> => {
  const lang = (testCase.lang ?? "bash").toLowerCase();
  const options = {
    cwd: context.dir,
    env: context.env,
    ...(context.timeoutMs ? { timeoutMs: context.timeoutMs } : {}),
  };
  if (["bash", "sh", "shell", "zsh"].includes(lang)) {
    return await exec("bash", ["-eo", "pipefail"], { ...options, input: code });
  }
  if (["javascript", "js", "mjs", "ts", "typescript"].includes(lang)) {
    const { code: js } = await transform(code, {
      format: "esm",
      loader: lang.startsWith("t") ? "ts" : "js",
    });
    await writeFile(path.join(context.dir, "snippet.mjs"), js);
    return await exec(process.execPath, ["snippet.mjs"], options);
  }
  await writeFile(path.join(context.dir, "snippet.py"), code);
  const pip = testCase.deps?.pip ?? [];
  uvAvailable ??= hasCommand("uv");
  if (await uvAvailable) {
    const withArgs = pip.flatMap((dep) => ["--with", dep]);
    return await exec(
      "uv",
      ["run", "--no-project", ...withArgs, "python", "snippet.py"],
      options
    );
  }
  if (pip.length > 0) {
    return {
      reason: "uv isn't installed, so pip dependencies can't be installed",
      status: "skip",
    };
  }
  return await exec("python3", ["snippet.py"], options);
};

interface Fixtures {
  get: (fixture: Fixture) => Promise<FixtureResult<unknown>>;
  teardown: () => Promise<void>;
}

const createFixtures = (runId: string): Fixtures => {
  const started = new Map<string, Promise<FixtureResult<unknown>>>();
  return {
    get: (fixture) => {
      let result = started.get(fixture.id);
      if (!result) {
        result = fixture.setup({ runId });
        started.set(fixture.id, result);
      }
      return result;
    },
    teardown: async () => {
      const results = await Promise.allSettled(started.values());
      await Promise.allSettled(
        results.map((result) =>
          result.status === "fulfilled" ? result.value.teardown?.() : undefined
        )
      );
    },
  };
};

/** Values for a run: the test's params, then secrets from their env variables. */
const runValues = (
  testCase: TestCase,
  fixtureValue: unknown,
  secrets: string[]
): Record<string, unknown> | Outcome => {
  const values: Record<string, unknown> = {
    ...testCase.spec?.options.params?.(fixtureValue),
  };
  for (const [name, param] of secretParams(testCase.definition)) {
    values[name] ??= param.state.env ? process.env[param.state.env] : undefined;
    if (values[name] === undefined) {
      const hint = param.state.env
        ? `set ${param.state.env}`
        : "pass it in defineTest params";
      return {
        reason: `secret "${name}" has no value (${hint})`,
        status: "skip",
      };
    }
    secrets.push(String(values[name]));
  }
  return values;
};

const prepareDir = async (testCase: TestCase, options: RunOptions) => {
  const npm = testCase.deps?.npm ?? [];
  const sandbox =
    npm.length > 0
      ? await npmSandbox(options.root, npm)
      : await mkdtemp(path.join(os.tmpdir(), "copybook-run-"));
  const dir = await caseDir(
    sandbox,
    `${testCase.id}-${testCase.variant ?? ""}-${options.runId}`
  );
  const files = Object.entries(testCase.spec?.options.files ?? {});
  await Promise.all(
    files.map(([file, content]) => writeFile(path.join(dir, file), content))
  );
  return dir;
};

const matchesStdout = (
  stdout: string,
  expected: RegExp | string | undefined
) => {
  if (expected === undefined) {
    return true;
  }
  return typeof expected === "string"
    ? stdout.includes(expected)
    : expected.test(stdout);
};

const isOutcome = (value: unknown): value is Outcome =>
  typeof value === "object" && value !== null && "status" in value;

const runTier = async (
  testCase: TestCase,
  options: RunOptions,
  fixtures: Fixtures,
  secrets: string[]
): Promise<Outcome> => {
  const spec = testCase.spec?.options;
  const fixture = spec?.fixture ? await fixtures.get(spec.fixture) : undefined;
  const values = runValues(testCase, fixture?.value, secrets);
  if (isOutcome(values)) {
    return values;
  }

  const result = await execute(testCase, renderCode(testCase, values), {
    dir: await prepareDir(testCase, options),
    env: { ...fixture?.env, ...spec?.env },
    ...(spec?.timeoutMs ? { timeoutMs: spec.timeoutMs } : {}),
  });
  if (isOutcome(result)) {
    return result;
  }
  if (result.timedOut || result.code !== (spec?.expect?.exitCode ?? 0)) {
    return failure(result, "the run");
  }
  const expected = spec?.expect?.stdout;
  return matchesStdout(result.stdout, expected)
    ? { status: "pass" }
    : {
        message: `stdout didn't match ${String(expected)}\n${tail(result.stdout)}`,
        status: "fail",
      };
};

const runCase = async (
  testCase: TestCase,
  options: RunOptions,
  fixtures: Fixtures
): Promise<TestResult> => {
  const started = performance.now();
  const secrets: string[] = [];
  const base = {
    id: testCase.id,
    tier: testCase.tier,
    ...(testCase.label ? { label: testCase.label } : {}),
    ...(testCase.variant ? { variant: testCase.variant } : {}),
  };

  let outcome: Outcome;
  try {
    if (testCase.skip) {
      outcome = { reason: testCase.skip, status: "skip" };
    } else if (testCase.tier === "run") {
      outcome = await runTier(testCase, options, fixtures, secrets);
    } else {
      const code = renderCode(testCase, standInSecrets(testCase.definition));
      outcome =
        testCase.tier === "syntax"
          ? await checkSyntax(testCase.lang, code, options.root)
          : await typecheck(testCase, options.root, code);
    }
  } catch (error) {
    outcome = {
      message: error instanceof Error ? error.message : String(error),
      status: "fail",
    };
  }

  const durationMs = Math.round(performance.now() - started);
  if (outcome.status === "pass") {
    return { ...base, durationMs, status: "pass" };
  }
  const message = outcome.status === "skip" ? outcome.reason : outcome.message;
  return {
    ...base,
    durationMs,
    message: redact(message, secrets),
    status: outcome.status,
  };
};

/** Runs every case, at most `concurrency` at a time, then tears fixtures down. */
export const runTests = async (
  cases: readonly TestCase[],
  options: RunOptions
): Promise<TestReport> => {
  const startedAt = new Date().toISOString();
  const fixtures = createFixtures(options.runId);
  const results: TestResult[] = Array.from({ length: cases.length });
  let next = 0;

  const worker = async () => {
    while (next < cases.length) {
      const index = next;
      next += 1;
      const testCase = cases[index];
      if (testCase) {
        // Each worker runs its cases one at a time; the pool runs workers in parallel.
        // oxlint-disable-next-line no-await-in-loop
        const result = await runCase(testCase, options, fixtures);
        results[index] = result;
        options.onResult?.(result);
      }
    }
  };

  try {
    await Promise.all(
      Array.from({ length: Math.max(1, options.concurrency) }, worker)
    );
  } finally {
    await fixtures.teardown();
  }

  return {
    finishedAt: new Date().toISOString(),
    results,
    runId: options.runId,
    startedAt,
    tiers: [...new Set(cases.map((testCase) => testCase.tier))],
  };
};
