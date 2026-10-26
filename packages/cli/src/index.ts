export { changedIds } from "./changes";
export { defineConfig, loadConfig } from "./config";
export type { Config, PlacementInfo, ResolvedConfig } from "./config";
export { fileHistory } from "./git";
export type { Commit } from "./git";
export { collectDefinitions, loadProject } from "./load";
export type { LoadedDefinition, Project } from "./load";
export { buildManifest } from "./manifest";
export type { Manifest, ManifestEntry, ManifestVariant } from "./manifest";
export { BIN_NAME, VERSION } from "./meta";
export { createProgram } from "./program";
export { compareSnapshots, createSnapshot, writeSnapshots } from "./snapshot";
export type { Snapshot, SnapshotStatus } from "./snapshot";
export { buildSnapshots } from "./validate";
export type { Issue } from "./validate";
export { defineFixture, defineTest } from "./test/define";
export type {
  Fixture,
  FixtureContext,
  FixtureResult,
  TestExpectation,
  TestOptions,
  TestSpec,
  Tier,
} from "./test/define";
export { buildPlan } from "./test/plan";
export { runTests } from "./test/runner";
export type {
  TestCase,
  TestReport,
  TestResult,
  TestStatus,
} from "./test/types";
export { claudeCode, codex, literal, scriptAgent } from "./eval/adapters";
export type { AgentAdapter, AgentInput, AgentRun } from "./eval/adapters";
export {
  assertThat,
  defineEval,
  fileContains,
  fileExists,
  notRan,
  ran,
  ranInOrder,
  succeeds,
} from "./eval/define";
export type {
  Assertion,
  AssertContext,
  AssertResult,
  EvalOptions,
  EvalSpec,
} from "./eval/define";
export { runEvals } from "./eval/runner";
export type { Shim, ShimCall } from "./eval/shims";
export type {
  EvalHistoryEntry,
  EvalReport,
  EvalResult,
  EvalTrial,
} from "./eval/types";
