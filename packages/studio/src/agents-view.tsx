import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { CopyButton } from "@/components/copybook/copy-button";
import { Button } from "@/components/ui/button";

import { fetchCommands, fetchStatus, startTests, writeSnapshots } from "./api";
import type {
  CatalogCommand,
  NextAction,
  StatusReport,
  TestDone,
} from "./types";
import { hrefFor } from "./use-hash-route";

const Section = ({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
      {title}
    </h2>
    {children}
  </section>
);

/** A command to copy, in a code block with a copy button. */
const Snippet = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1.5">
    <p className="text-muted-foreground text-xs">{label}</p>
    <div className="bg-muted flex items-start justify-between gap-2 border">
      <pre className="overflow-x-auto p-3 font-mono text-xs">{value}</pre>
      <CopyButton label={`Copy: ${label}`} value={value} />
    </div>
  </div>
);

/** How an MCP client launches the server, from the project's runner. */
const mcpLaunch = (runner: string) => {
  const [command = "npx", ...args] = runner.split(" ");
  // --no keeps npx from prompting to install, which would hang the server.
  const launch =
    command === "npx" ? ["--no", ...args, "mcp"] : [...args, "mcp"];
  return { args: launch, command, line: [command, ...launch].join(" ") };
};

/** The actions Studio can take itself: writing snapshots and safe tests. */
const RUNNABLE = new Set(["fix-tests", "run-tests", "write-snapshots"]);

const ActionRow = ({
  action,
  busy,
  onRun,
}: {
  action: NextAction;
  busy: boolean;
  onRun: (action: NextAction) => void;
}) => (
  <li className="flex flex-col gap-2 p-3">
    <div className="flex items-start justify-between gap-4">
      <p className="text-sm">{action.title}</p>
      {action.safe && RUNNABLE.has(action.code) ? (
        <Button
          disabled={busy}
          onClick={() => onRun(action)}
          size="xs"
          variant="outline"
        >
          Run
        </Button>
      ) : null}
    </div>
    {action.ids && action.ids.length > 0 ? (
      <ul className="flex flex-wrap gap-2">
        {action.ids.map((id) => (
          <li key={id}>
            <a
              className="hover:bg-muted border px-2 py-1 font-mono text-xs"
              href={hrefFor(id)}
            >
              {id}
            </a>
          </li>
        ))}
      </ul>
    ) : null}
    {action.command ? (
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <code className="font-mono">{action.command}</code>
        <CopyButton label={`Copy ${action.command}`} value={action.command} />
        {action.tool ? <span>MCP: {action.tool}</span> : null}
        {action.safe ? null : <span>Ask first</span>}
      </div>
    ) : null}
  </li>
);

const POLICY_LABELS = {
  ask: "Ask first",
  "ci-only": "CI only",
  safe: "Safe",
} as const;

const CommandTable = ({ commands }: { commands: CatalogCommand[] }) => (
  <table className="w-full border text-left text-xs">
    <thead className="text-muted-foreground">
      <tr className="border-b">
        <th className="p-2 font-medium" scope="col">
          Command
        </th>
        <th className="p-2 font-medium" scope="col">
          Agents
        </th>
        <th className="p-2 font-medium" scope="col">
          What it does
        </th>
      </tr>
    </thead>
    <tbody>
      {commands.map((command) => (
        <tr className="border-b align-top last:border-b-0" key={command.name}>
          <td className="p-2 font-mono whitespace-nowrap">{command.usage}</td>
          <td className="p-2 whitespace-nowrap">
            {POLICY_LABELS[command.agent]}
          </td>
          <td className="p-2">
            {command.summary}
            {command.notes ? (
              <span className="text-muted-foreground block">
                {command.notes}
              </span>
            ) : null}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const useStatus = (version: string) => {
  const [status, setStatus] = useState<StatusReport | undefined>();
  const [commands, setCommands] = useState<CatalogCommand[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [next, catalog] = await Promise.all([
        fetchStatus(version).catch(() => null),
        fetchCommands().catch(() => ({ commands: [] })),
      ]);
      if (!cancelled) {
        setStatus(next ?? undefined);
        setCommands(catalog.commands);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [version]);
  return { commands, status };
};

const describeRun = (done: TestDone) =>
  `Tests finished: ${done.passed} passed, ${done.failed} failed, ${done.skipped} skipped.`;

/**
 * Everything an agent, or a person handing work to one, needs: what to do
 * next, how to connect an agent over MCP, and every CLI command.
 */
export const AgentsView = ({
  lastTest,
  version,
}: {
  lastTest?: TestDone;
  version: string;
}) => {
  const { commands, status } = useStatus(`${version}|${lastTest?.runId ?? ""}`);
  const [message, setMessage] = useState("");
  const [runId, setRunId] = useState<string | undefined>();
  const running = runId !== undefined && lastTest?.runId !== runId;
  const llms = `${window.location.origin}/llms.txt`;

  const run = async (action: NextAction) => {
    try {
      if (action.code === "write-snapshots") {
        const { written } = await writeSnapshots();
        setMessage(
          `Wrote ${written.added.length + written.updated.length} snapshots. Review and commit them.`
        );
        return;
      }
      const started = await startTests(
        action.code === "fix-tests" ? action.ids : undefined
      );
      setRunId(started.runId);
      setMessage("Running the syntax and typecheck tests…");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const launch = mcpLaunch(status?.runner ?? "npx copybook");
  const finished =
    lastTest && lastTest.runId === runId ? describeRun(lastTest) : "";

  return (
    <article className="flex max-w-4xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Project
        </p>
        <h1 className="text-xl font-semibold">Agents</h1>
        <p className="text-muted-foreground text-sm">
          What needs doing in {status?.name ?? "this project"}, and how a coding
          agent can do it. Agents can also read{" "}
          <a className="underline underline-offset-4" href={llms}>
            {llms}
          </a>{" "}
          and call the API of this Studio.
        </p>
      </header>

      <p aria-live="polite" className="text-sm">
        {finished || message}
      </p>

      <Section title="What to do next">
        {status === undefined ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : null}
        {status?.clean ? (
          <p className="text-sm">
            Nothing to do. Every snapshot is up to date and the latest tests
            pass.
          </p>
        ) : null}
        {status && !status.clean ? (
          <ol className="divide-y border">
            {status.next.map((action) => (
              <ActionRow
                action={action}
                busy={running}
                key={action.code}
                onRun={run}
              />
            ))}
          </ol>
        ) : null}
      </Section>

      <Section title="Connect your coding agent">
        <p className="text-muted-foreground text-sm">
          <code>{launch.line}</code> starts the Copybook MCP server in this
          project. Its tools inspect, render, check, snapshot, and test
          definitions.
        </p>
        <Snippet
          label="Claude Code"
          value={`claude mcp add copybook -- ${launch.line}`}
        />
        <Snippet
          label="Codex"
          value={`codex mcp add copybook -- ${launch.line}`}
        />
        <Snippet
          label=".mcp.json, .cursor/mcp.json, and other MCP configs"
          value={JSON.stringify(
            {
              mcpServers: {
                copybook: { args: launch.args, command: launch.command },
              },
            },
            null,
            2
          )}
        />
      </Section>

      <Section title="Commands">
        <p className="text-muted-foreground text-sm">
          Every command takes <code>--json</code> except <code>report</code>.
          Run them with <code>{status?.runner ?? "npx copybook"}</code>.
        </p>
        {commands.length > 0 ? <CommandTable commands={commands} /> : null}
      </Section>
    </article>
  );
};
