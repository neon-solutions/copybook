import path from "node:path";

import type { Command } from "commander";

import { buildCatalog } from "../catalog";
import { colors as pc, cwd, write, writeError } from "../output";
import { startStudio } from "../studio/server";

interface StudioCommandOptions {
  apiOnly?: boolean;
  config?: string;
  host: string;
  json?: boolean;
  port: string;
}

const DEFAULT_PORT = "4983";

export const registerStudio = (program: Command) =>
  program
    .command("studio")
    .description("Browse, preview, and trace every definition in a local UI.")
    .option("-p, --port <port>", "the port to listen on", DEFAULT_PORT)
    .option("--host <host>", "the host to bind", "127.0.0.1")
    .option("--api-only", "serve only the JSON API")
    .option("--json", "print the URLs as one line of JSON once it's listening")
    .option("-c, --config <path>", "the config file")
    .action(async (options: StudioCommandOptions, command: Command) => {
      const studio = await startStudio({
        ...(options.apiOnly ? { apiOnly: true } : {}),
        catalog: buildCatalog(command.parent ?? program),
        ...(options.config ? { config: options.config } : {}),
        cwd: cwd(),
        host: options.host,
        port: Number(options.port),
        // The CLI bundle lives in dist/, next to dist/studio.
        staticDir: path.join(import.meta.dirname, "studio"),
      });
      if (!studio.loopback) {
        writeError(
          `${pc.yellow("warning")} Studio is listening on ${options.host}, so other machines can reach it, and it imports your code. Use 127.0.0.1 unless you need that.`
        );
      }
      if (options.json) {
        // One line, since the process keeps running after it.
        write(
          JSON.stringify({
            api: `${studio.url}/api`,
            llms: `${studio.url}/llms.txt`,
            ok: true,
            schemaVersion: 1,
            url: studio.url,
          })
        );
        return;
      }
      write(`${pc.bold("Copybook Studio")} ${pc.cyan(studio.url)}`);
      write(
        pc.dim(
          `Agents: ${studio.url}/llms.txt. Watching for changes. Press Ctrl+C to stop.`
        )
      );
    });
