import { format } from "node:util";

import type { Command } from "commander";

import { cwd } from "../output";
import { openWorkspace } from "../workspace";
import type { Workspace } from "../workspace";

interface McpOptions {
  config?: string;
}

const toStderr = (...args: unknown[]) => {
  process.stderr.write(`${format(...args)}\n`);
};

/**
 * stdout carries the protocol, so anything the project's code logs while it
 * loads goes to stderr instead.
 */
const keepStdoutForProtocol = () => {
  Object.assign(console, { debug: toStderr, info: toStderr, log: toStderr });
};

export const registerMcp = (program: Command) =>
  program
    .command("mcp")
    .description(
      "Serve this project to coding agents over MCP, on stdio. Your agent's MCP client starts it."
    )
    .option("-c, --config <path>", "the config file")
    .action(async (options: McpOptions) => {
      keepStdoutForProtocol();
      const root = cwd();
      const open = async () => {
        const workspace = await openWorkspace({
          cwd: root,
          ...(options.config ? { config: options.config } : {}),
        });
        workspace.watch();
        return workspace;
      };
      let loading: Promise<Workspace> | undefined;
      // Loads on the first tool call, and again after a failure, so the
      // server starts before `copybook init` and recovers once it runs.
      const getWorkspace = async () => {
        loading ??= open();
        try {
          return await loading;
        } catch (error) {
          loading = undefined;
          throw error;
        }
      };

      const [{ serveStdio }, { createCopybookMcp }] = await Promise.all([
        import("@modelcontextprotocol/server/stdio"),
        import("../mcp/server"),
      ]);
      const handle = serveStdio(() => createCopybookMcp(getWorkspace));
      const stop = async () => {
        await handle.close();
        try {
          const workspace = await loading;
          workspace?.close();
        } catch {
          // It never loaded, so there's nothing to close.
        }
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
      // Exit when the client closes stdin; the file watcher would keep the
      // process alive otherwise.
      process.stdin.once("end", stop);
    });
