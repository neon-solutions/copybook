import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { checkIssues, searchDefinitions } from "../analysis";
import type { DefinitionEntry } from "../analysis";
import { changedIds } from "../changes";
import { definitionMarkdown, renderOutputs } from "../detail";
import { snapshotPatch } from "../diff";
import { errorEnvelope } from "../errors";
import { VERSION } from "../meta";
import { nextActions } from "../next-actions";
import type { Issue } from "../validate";
import type { Workspace } from "../workspace";

const INSTRUCTIONS = `Copybook keeps the code snippets, shell commands, and coding-agent prompts that this product shows to users as typed definitions, each with a stable id and a committed snapshot of its rendered output.

Start with status: its next field lists what to do, in order, and which tool does each step. Use find_definitions to find the definition behind text you see in the UI, get_definition to read one, and render to try values. After you edit definitions, call write_snapshots, then check, and commit the snapshots with the code. run_tests runs the syntax and typecheck tiers. The run tier and evals stay in the CLI and CI; ask before prune_snapshots, which deletes files.`;

const DEFAULT_LIMIT = 50;

const text = (value: string) => ({
  content: [{ text: value, type: "text" as const }],
});

const json = (value: unknown) => text(JSON.stringify(value, null, 2));

const failure = (error: unknown) => ({
  ...json(errorEnvelope(error)),
  isError: true,
});

/** Turns thrown errors into tool errors the agent can read. */
const safely =
  <A>(handler: (args: A) => Promise<ReturnType<typeof text>>) =>
  async (args: A) => {
    try {
      return await handler(args);
    } catch (error) {
      return failure(error);
    }
  };

const summarize = (entry: DefinitionEntry) => ({
  id: entry.id,
  kind: entry.kind,
  placements: entry.placements,
  renderedIn: entry.renderedIn,
  snapshot: entry.snapshot,
  source: `${entry.source.file}#${entry.source.export}`,
  ...(entry.title ? { title: entry.title } : {}),
  usedBy: entry.usedBy,
});

const orphanIssues = (ids: readonly string[]): Issue[] =>
  ids.map((id) => ({
    code: "snapshot-orphaned",
    id,
    level: "warning",
    message: "Has a snapshot but no definition.",
  }));

/**
 * Copybook's MCP server for one project. `getWorkspace` loads the project
 * on first use, so the server starts even before `copybook init`.
 */
export const createCopybookMcp = (
  getWorkspace: () => Promise<Workspace>
): McpServer => {
  const server = new McpServer(
    { name: "copybook", version: VERSION },
    { instructions: INSTRUCTIONS }
  );

  server.registerTool(
    "status",
    {
      annotations: { openWorldHint: false, readOnlyHint: true },
      description:
        "What needs doing: definition counts, missing, changed, and orphaned snapshots, issues, the latest test and eval results, and the next steps, each with the tool to use. Call it first.",
      inputSchema: z.object({}),
      title: "Project status",
    },
    safely(async () => {
      const workspace = await getWorkspace();
      return json(await workspace.status());
    })
  );

  server.registerTool(
    "find_definitions",
    {
      annotations: { openWorldHint: false, readOnlyHint: true },
      description:
        "Lists definitions. query matches ids, titles, descriptions, placements, tags, and the rendered output, so it finds the definition behind text shown in the UI.",
      inputSchema: z.object({
        changedSince: z
          .string()
          .optional()
          .describe(
            "Only definitions whose output changed since this git ref."
          ),
        kind: z.enum(["command", "prompt", "snippet"]).optional(),
        limit: z.number().int().positive().optional(),
        placement: z.string().optional(),
        query: z.string().optional(),
        unused: z
          .boolean()
          .optional()
          .describe("Only definitions no product file renders."),
      }),
      title: "Find definitions",
    },
    safely(async (args) => {
      const workspace = await getWorkspace();
      const analysis = await workspace.current();
      let entries = args.query
        ? searchDefinitions(analysis, args.query)
        : analysis.entries;
      if (args.kind) {
        entries = entries.filter((entry) => entry.kind === args.kind);
      }
      if (args.placement) {
        const { placement } = args;
        entries = entries.filter((entry) =>
          entry.placements.includes(placement)
        );
      }
      if (args.unused) {
        const unused = new Set(analysis.usage?.unused);
        entries = entries.filter((entry) => unused.has(entry.id));
      }
      if (args.changedSince) {
        const changed = new Set(
          await changedIds(
            analysis.project,
            analysis.snapshots,
            args.changedSince
          )
        );
        entries = entries.filter((entry) => changed.has(entry.id));
      }
      const limit = args.limit ?? DEFAULT_LIMIT;
      return json({
        definitions: entries.slice(0, limit).map(summarize),
        total: entries.length,
      });
    })
  );

  server.registerTool(
    "get_definition",
    {
      annotations: { openWorldHint: false, readOnlyHint: true },
      description:
        "One definition as Markdown: source, placements, the files that render it, embeds and embedders, params, the output of every variant, test and eval results, snapshot history, and next steps. Old ids resolve through aliases.",
      inputSchema: z.object({ id: z.string() }),
      title: "Get a definition",
    },
    safely(async ({ id }) => {
      const workspace = await getWorkspace();
      return text(definitionMarkdown(await workspace.definition(id)));
    })
  );

  server.registerTool(
    "render",
    {
      annotations: { openWorldHint: false, readOnlyHint: true },
      description:
        "Renders a definition with values over its examples, for every variant or just one.",
      inputSchema: z.object({
        id: z.string(),
        values: z.record(z.string(), z.unknown()).optional(),
        variant: z.string().optional(),
      }),
      title: "Render a definition",
    },
    safely(async ({ id, values, variant }) => {
      const workspace = await getWorkspace();
      const analysis = await workspace.current();
      return json({
        outputs: renderOutputs(analysis, id, {
          ...(values ? { values } : {}),
          ...(variant ? { variant } : {}),
        }),
      });
    })
  );

  server.registerTool(
    "check",
    {
      annotations: { openWorldHint: false, readOnlyHint: true },
      description:
        "What copybook check reports: validation issues, missing, stale, and orphaned snapshots with diffs, unused definitions, and, with base, ids removed without an alias.",
      inputSchema: z.object({
        base: z
          .string()
          .optional()
          .describe("Also report ids removed since this git ref."),
      }),
      title: "Check snapshots",
    },
    safely(async ({ base }) => {
      const workspace = await getWorkspace();
      const analysis = await workspace.current();
      const issues = await checkIssues(analysis, base ? { base } : {});
      return json({
        diffs: Object.fromEntries(
          analysis.status.changed.map((change) => [
            change.id,
            snapshotPatch(
              change,
              analysis.project.config,
              analysis.project.config.root
            ),
          ])
        ),
        issues,
        next: nextActions(issues),
        ok: !issues.some((issue) => issue.level === "error"),
      });
    })
  );

  server.registerTool(
    "write_snapshots",
    {
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description:
        "Writes the missing and changed snapshots, like copybook snapshot. Review the diff and commit the snapshots with the code.",
      inputSchema: z.object({}),
      title: "Write snapshots",
    },
    safely(async () => {
      const workspace = await getWorkspace();
      const result = await workspace.writeSnapshots();
      return json({
        ...result,
        next: nextActions([
          ...result.issues,
          ...orphanIssues(result.written.orphaned),
        ]),
      });
    })
  );

  server.registerTool(
    "prune_snapshots",
    {
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: false,
      },
      description:
        "Deletes snapshots whose definitions no longer exist, and writes the rest. If a definition was renamed, add its old id to aliases instead. Ask first.",
      inputSchema: z.object({}),
      title: "Prune snapshots",
    },
    safely(async () => {
      const workspace = await getWorkspace();
      return json(await workspace.writeSnapshots({ prune: true }));
    })
  );

  server.registerTool(
    "run_tests",
    {
      annotations: {
        destructiveHint: false,
        openWorldHint: true,
        readOnlyHint: false,
      },
      description:
        "Runs the syntax and typecheck tests of commands and snippets, like copybook test. Typecheck installs packages into a sandbox, so it can take a while. The run tier executes commands for real and stays in the CLI.",
      inputSchema: z.object({
        changedSince: z
          .string()
          .optional()
          .describe(
            "Only definitions whose output changed since this git ref."
          ),
        ids: z.array(z.string()).optional(),
        tiers: z.array(z.enum(["syntax", "typecheck"])).optional(),
      }),
      title: "Run tests",
    },
    safely(async ({ changedSince, ids, tiers }) => {
      const workspace = await getWorkspace();
      const { report, unknownIds } = await workspace.runTests({
        ...(changedSince ? { base: changedSince, changed: true } : {}),
        ...(ids ? { ids } : {}),
        tiers: tiers ?? ["syntax", "typecheck"],
      });
      const failures = report.results.filter(
        (result) => result.status === "fail"
      );
      const count = (status: string) =>
        report.results.filter((result) => result.status === status).length;
      return json({
        failures,
        next: nextActions([], { test: report }),
        ok: failures.length === 0,
        summary: {
          failed: failures.length,
          passed: count("pass"),
          skipped: count("skip"),
        },
        unknownIds,
      });
    })
  );

  return server;
};
