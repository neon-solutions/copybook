import type { Definition, InputValues, ParamsShape } from "@copybook/core";

export const TEST = Symbol.for("copybook.test");
export const FIXTURE = Symbol.for("copybook.fixture");

export type Tier = "run" | "syntax" | "typecheck";
export const TIERS: readonly Tier[] = ["syntax", "typecheck", "run"];

export interface FixtureContext {
  /** Unique per test run. Name created resources `copybook-<runId>` so leaks are easy to find. */
  runId: string;
}

export interface FixtureResult<V> {
  /** Extra environment variables for tests that use this fixture. */
  env?: Record<string, string>;
  /** Called once after every test that uses the fixture, even on failure. */
  teardown?: () => Promise<void> | void;
  value: V;
}

export interface Fixture<V = unknown> {
  readonly [FIXTURE]: true;
  readonly id: string;
  readonly setup: (context: FixtureContext) => Promise<FixtureResult<V>>;
}

/**
 * Something a test needs to exist, such as a temporary database branch.
 * It's set up once per run, and only when a selected test uses it.
 */
export const defineFixture = <V>(input: {
  id: string;
  setup: (context: FixtureContext) => Promise<FixtureResult<V>>;
}): Fixture<V> => Object.freeze({ ...input, [FIXTURE]: true as const });

export interface TestExpectation {
  exitCode?: number;
  /** Must match stdout. */
  stdout?: RegExp | string;
}

export interface TestOptions<S extends ParamsShape, V> {
  /** Extra environment variables for the run tier. */
  env?: Record<string, string>;
  expect?: TestExpectation;
  fixture?: Fixture<V>;
  /** Values for the run tier. Secrets fall back to their `env` variables. */
  params?: (fixture: V) => Partial<InputValues<S>>;
  /** Files written into the sandbox before the run, relative to it. */
  files?: Record<string, string>;
  timeoutMs?: number;
  /** Variant keys to run. Defaults to every variant. */
  variants?: readonly string[];
}

export interface TestSpec {
  readonly [TEST]: true;
  readonly id: string;
  readonly options: TestOptions<ParamsShape, unknown>;
}

/**
 * Configures how `copybook test --tier run` executes a definition.
 * `S` is inferred only from the definition and `V` only from the fixture,
 * which keeps literal types in `params` (such as an enum value) intact.
 */
export const defineTest = <S extends ParamsShape, V = undefined>(
  definition: Definition<S>,
  options: NoInfer<TestOptions<S, V>> & { fixture?: Fixture<V> }
): TestSpec =>
  Object.freeze({
    [TEST]: true as const,
    id: definition.id,
    options: options as TestOptions<ParamsShape, unknown>,
  });

export const isTestSpec = (value: unknown): value is TestSpec =>
  typeof value === "object" && value !== null && TEST in value;
