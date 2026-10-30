import path from "node:path";

import type { Command } from "commander";
import pc from "picocolors";

import { write } from "../output";
import { startStudio } from "../studio/server";

interface StudioCommandOptions {
  apiOnly?: boolean;
  config?: string;
  host: string;
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
    .option("-c, --config <path>", "the config file")
    .action(async (options: StudioCommandOptions) => {
      const studio = await startStudio({
        ...(options.apiOnly ? { apiOnly: true } : {}),
        ...(options.config ? { config: options.config } : {}),
        cwd: process.cwd(),
        host: options.host,
        port: Number(options.port),
        // The CLI bundle lives in dist/, next to dist/studio.
        staticDir: path.join(import.meta.dirname, "studio"),
      });
      write(`${pc.bold("Copybook Studio")} ${pc.cyan(studio.url)}`);
      write(pc.dim("Watching for changes. Press Ctrl+C to stop."));
    });
