export {
  analyzeProject,
  checkIssues,
  findDefinition,
  loadAnalysis,
  searchDefinitions,
  suggestIds,
} from "./analysis";
export type {
  Analysis,
  DefinitionEntry,
  FoundDefinition,
  SnapshotState,
} from "./analysis";
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
export { CopybookError, errorEnvelope } from "./errors";
export type { ErrorCode } from "./errors";
export type { NextAction } from "./next-actions";
export type { CliContext, CliStream } from "./output";
export { runCli } from "./run";
export { compareSnapshots, createSnapshot, writeSnapshots } from "./snapshot";
export type { Snapshot, SnapshotStatus } from "./snapshot";
export { buildSnapshots } from "./validate";
export type { Issue, IssueCode } from "./validate";
export { readResults, RESULTS_DIR } from "./results";
export { buildStatus } from "./status";
export { renderAgentsBlock, upsertBlock } from "./agents/agents-md";
export { mcpServerEntry, mergeMcpConfig } from "./agents/mcp-config";
export type { McpServerEntry } from "./agents/mcp-config";
export { applyAgentSetup, codexCommand, planAgentSetup } from "./agents/setup";
export type { FileChange } from "./agents/setup";
export { renderSkill } from "./agents/skill";
export { buildCatalog, COMMAND_META } from "./catalog";
export type {
  AgentPolicy,
  CatalogCommand,
  CatalogOption,
  CommandCatalog,
  CommandEffect,
} from "./catalog";
export { definitionDetail, definitionMarkdown, renderOutputs } from "./detail";
export type { DefinitionDetail, DefinitionOutput } from "./detail";
export type { StatusReport } from "./status";
export { nextActions, runnerFor } from "./next-actions";
export type { Results } from "./results";
export { runProjectTests } from "./test/run-project";
export type { ProjectTestOptions, ProjectTestRun } from "./test/run-project";
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
export { findUsages } from "./usages";
export type { UsageReport } from "./usages";
export { buildReport, REPORT_MARKER } from "./report";
export type { ReportInput } from "./report";
