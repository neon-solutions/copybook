import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

import { findDefinition } from "../analysis";
import type { CommandCatalog } from "../catalog";
import { definitionMarkdown } from "../detail";
import type { Project } from "../load";
import { VERSION } from "../meta";
import { nextActions } from "../next-actions";
import type { Tier } from "../test/define";
import type { Issue } from "../validate";
import { openWorkspace } from "../workspace";
import type { Workspace } from "../workspace";
import {
  guardRequest,
  HttpError,
  isLoopback,
  readJsonBody,
  toErrorResponse,
} from "./guard";

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const DEFINITIONS_PREFIX = "/api/definitions/";

export interface StudioOptions {
  /** Serve only `/api`, for developing the Studio UI with Vite. */
  apiOnly?: boolean;
  /** The CLI's command catalog, for `/api/commands`. */
  catalog?: CommandCatalog;
  config?: string;
  cwd: string;
  host: string;
  /** Loads the project. Tests use it to point snapshots at a temp dir. */
  load?: () => Promise<Project>;
  port: number;
  /** The built Studio UI. */
  staticDir: string;
  /** Watch files and reload on change. Defaults to true. */
  watch?: boolean;
}

interface Endpoint {
  method: "GET" | "POST";
  path: string;
  summary: string;
}

/** Every route, for `GET /api` and `/llms.txt`. */
export const ENDPOINTS: readonly Endpoint[] = [
  { method: "GET", path: "/api", summary: "This index, as JSON." },
  {
    method: "GET",
    path: "/api/status",
    summary:
      "What needs doing: snapshots, issues, the latest results, and next steps. Same as `copybook status --json`.",
  },
  {
    method: "GET",
    path: "/api/manifest",
    summary:
      "Every definition, with its snapshot state, embedders, and the files that render it.",
  },
  {
    method: "GET",
    path: "/api/definitions/{id}",
    summary:
      "One definition: params, output, tests, and history. Same as `copybook show <id> --json`.",
  },
  {
    method: "GET",
    path: "/api/definitions/{id}.md",
    summary: "One definition as Markdown, to hand to an agent.",
  },
  {
    method: "POST",
    path: "/api/render",
    summary: "Renders a definition: `{ id, values?, variant? }`.",
  },
  {
    method: "POST",
    path: "/api/snapshot",
    summary:
      "Writes the missing and changed snapshots: `{ prune? }`. Same as `copybook snapshot --json`.",
  },
  {
    method: "POST",
    path: "/api/test",
    summary:
      "Runs the syntax and typecheck tests in the background: `{ ids?, tiers? }`. Answers 202 with a `runId`; results stream as `test` and `test-done` events and land in `/api/results`.",
  },
  {
    method: "GET",
    path: "/api/history?id={id}",
    summary: "The commits that changed a definition's snapshot.",
  },
  {
    method: "GET",
    path: "/api/results",
    summary: "The latest `copybook test` and `copybook eval` reports.",
  },
  {
    method: "GET",
    path: "/api/commands",
    summary: "Every CLI command and flag. Same as `copybook commands --json`.",
  },
  {
    method: "GET",
    path: "/api/events",
    summary:
      "Server-sent events: `change` after a reload, `error` when one fails, and `test`, `test-done`, and `test-error` for test runs.",
  },
];

/** A guide to this Studio's API, for agents that fetch it. */
export const studioMarkdown = (
  url: string,
  name: string
) => `# Copybook Studio: ${name}

> The local Studio for ${name}, served by \`copybook studio\` at ${url}. It shows every definition: where it's shown, its params, its rendered output, tests, and history.

Start with \`GET ${url}/api/status\`. Its \`next\` field lists what to do, with the CLI command and MCP tool for each step. POST requests need \`Content-Type: application/json\`. Writing snapshots and running tests only work while Studio listens on localhost; the run tier and evals stay in the CLI.

## Endpoints

${ENDPOINTS.map((endpoint) => `- \`${endpoint.method} ${endpoint.path}\`: ${endpoint.summary}`).join("\n")}

## Errors

Errors are \`{ "error": { "code", "message" }, "next": [...] }\`, with 400 for bad input, 403 for requests from other sites, 404 for unknown ids (with suggestions), 415 for non-JSON POSTs, and 422 for values a definition rejects.

Docs: https://copybook.dev/docs/guides/studio
`;

const sendJson = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { "Content-Type": CONTENT_TYPES[".json"] });
  response.end(JSON.stringify(body));
};

const sendMarkdown = (response: ServerResponse, text: string) => {
  response.writeHead(200, {
    "Content-Type": CONTENT_TYPES[".md"],
    Vary: "Accept",
  });
  response.end(text);
};

const prefersMarkdown = (request: IncomingMessage) => {
  const accept = request.headers.accept ?? "";
  const markdown = accept.indexOf("text/markdown");
  const html = accept.indexOf("text/html");
  return markdown !== -1 && (html === -1 || markdown < html);
};

const serveStatic = async (
  staticDir: string,
  pathname: string,
  response: ServerResponse
) => {
  const requested = path.normalize(path.join(staticDir, pathname));
  const insideStatic = requested.startsWith(staticDir + path.sep);
  const file =
    insideStatic && existsSync(requested) && path.extname(requested) !== ""
      ? requested
      : path.join(staticDir, "index.html");
  try {
    const content = await readFile(file);
    response.writeHead(200, {
      "Content-Type":
        CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream",
    });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Studio UI not found. Build @copybook/studio first.");
  }
};

const stringField = (body: Record<string, unknown>, key: string) => {
  const value = body[key];
  return typeof value === "string" ? value : undefined;
};

const recordField = (body: Record<string, unknown>, key: string) => {
  const value = body[key];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

type Handler = (
  request: IncomingMessage,
  url: URL
) => Promise<{ json: unknown; status?: number } | { markdown: string }>;

interface RouteContext {
  baseUrl: () => string;
  broadcast: (event: string, data: unknown) => void;
  /** Writes are off when Studio listens beyond localhost. */
  loopback: boolean;
  options: StudioOptions;
  /** The test run in progress, if any. */
  tests: { runId?: string; running?: Promise<void> };
  workspace: Workspace;
}

const TEST_TIERS = new Set<string>(["syntax", "typecheck"]);

const requireWritable = (loopback: boolean) => {
  if (!loopback) {
    throw new HttpError(
      403,
      "READ_ONLY",
      "Studio is read-only when it listens beyond localhost."
    );
  }
};

const parseTiers = (value: unknown): Tier[] => {
  if (value === undefined) {
    return ["syntax", "typecheck"];
  }
  if (
    !Array.isArray(value) ||
    !value.every((tier) => typeof tier === "string" && TEST_TIERS.has(tier))
  ) {
    throw new HttpError(
      400,
      "BAD_REQUEST",
      'tiers must be a list of "syntax" and "typecheck". The run tier executes commands for real, so run `copybook test --tier run` yourself.'
    );
  }
  return value as Tier[];
};

const parseIds = (value: unknown) => {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value) || !value.every((id) => typeof id === "string")) {
    throw new HttpError(400, "BAD_REQUEST", "ids must be a list of strings.");
  }
  return value as string[];
};

/** Runs tests and reports them as events, so the request returns now. */
const runInBackground = async (
  { broadcast, tests, workspace }: RouteContext,
  options: { ids?: string[]; runId: string; tiers: Tier[] }
) => {
  const { runId } = options;
  try {
    const { report, unknownIds } = await workspace.runTests({
      ...options,
      onResult: (result) => broadcast("test", { result, runId }),
    });
    const count = (status: string) =>
      report.results.filter((result) => result.status === status).length;
    broadcast("test-done", {
      failed: count("fail"),
      next: nextActions([], { test: report }),
      passed: count("pass"),
      runId,
      skipped: count("skip"),
      unknownIds,
    });
  } catch (error) {
    broadcast("test-error", {
      message: error instanceof Error ? error.message : String(error),
      runId,
    });
  } finally {
    tests.runId = undefined;
  }
};

const startTests = async (context: RouteContext, request: IncomingMessage) => {
  requireWritable(context.loopback);
  const body = await readJsonBody(request);
  const tiers = parseTiers(body.tiers);
  const ids = parseIds(body.ids);
  // No await between the check and the claim, so runs can't overlap.
  const { tests } = context;
  if (tests.runId) {
    throw new HttpError(
      409,
      "BUSY",
      `Tests are already running (run ${tests.runId}). Wait for its test-done event.`
    );
  }
  const runId = randomBytes(4).toString("hex");
  tests.runId = runId;
  tests.running = runInBackground(context, {
    ...(ids ? { ids } : {}),
    runId,
    tiers,
  });
  return {
    json: {
      events: `${context.baseUrl()}/api/events`,
      ok: true,
      results: `${context.baseUrl()}/api/results`,
      runId,
      schemaVersion: 1,
    },
    status: 202,
  };
};

const routes = (
  context: RouteContext
): Record<string, { method: "GET" | "POST"; run: Handler }> => {
  const { baseUrl, options, workspace } = context;
  return {
    "/api": {
      method: "GET",
      run: async () => {
        const analysis = await workspace.current();
        return {
          json: {
            endpoints: ENDPOINTS,
            llms: `${baseUrl()}/llms.txt`,
            name: path.basename(analysis.project.config.root),
            schemaVersion: 1,
            version: VERSION,
          },
        };
      },
    },
    "/api/commands": {
      method: "GET",
      run: () => {
        if (!options.catalog) {
          throw new HttpError(404, "NOT_FOUND", "No command catalog.");
        }
        return Promise.resolve({ json: options.catalog });
      },
    },
    "/api/history": {
      method: "GET",
      run: async (_request, url) => ({
        json: await workspace.history(url.searchParams.get("id") ?? ""),
      }),
    },
    "/api/manifest": {
      method: "GET",
      run: async () => {
        const analysis = await workspace.current();
        return {
          json: {
            definitions: analysis.entries,
            issues: analysis.issues,
            loadedAt: analysis.loadedAt,
            name: path.basename(analysis.project.config.root),
          },
        };
      },
    },
    "/api/render": {
      method: "POST",
      run: async (request) => {
        const body = await readJsonBody(request);
        const variant = stringField(body, "variant");
        return {
          json: await workspace.render(
            stringField(body, "id") ?? "",
            recordField(body, "values"),
            variant
          ),
        };
      },
    },
    "/api/results": {
      method: "GET",
      run: async () => ({ json: await workspace.results() }),
    },
    "/api/snapshot": {
      method: "POST",
      run: async (request) => {
        requireWritable(context.loopback);
        const body = await readJsonBody(request);
        const prune = body.prune === true;
        const result = await workspace.writeSnapshots({ prune });
        const orphaned: Issue[] = result.written.orphaned.map((id) => ({
          code: "snapshot-orphaned",
          id,
          level: "warning",
          message: "Has a snapshot but no definition.",
        }));
        return {
          json: {
            ...result,
            next: nextActions([...result.issues, ...orphaned]),
            ok: !result.issues.some((issue) => issue.level === "error"),
            schemaVersion: 1,
          },
        };
      },
    },
    "/api/status": {
      method: "GET",
      run: async () => ({ json: await workspace.status() }),
    },
    "/api/test": {
      method: "POST",
      run: (request) => startTests(context, request),
    },
  };
};

const definitionRoute = async (
  workspace: Workspace,
  pathname: string
): Promise<{ json: unknown; status?: number } | { markdown: string }> => {
  const id = decodeURIComponent(pathname.slice(DEFINITIONS_PREFIX.length));
  const base = id.endsWith(".md") ? id.slice(0, -".md".length) : undefined;
  if (base && findDefinition(await workspace.current(), base)) {
    return { markdown: definitionMarkdown(await workspace.definition(base)) };
  }
  return { json: await workspace.definition(id) };
};

/** Starts Studio: the JSON API plus the prebuilt UI, with live reload. */
export const startStudio = async (options: StudioOptions) => {
  const workspace = await openWorkspace({
    cwd: options.cwd,
    ...(options.config ? { config: options.config } : {}),
    ...(options.load ? { load: options.load } : {}),
  });
  const loopback = isLoopback(options.host);
  const clients = new Set<ServerResponse>();
  let baseUrl = "";
  const broadcast = (event: string, data: unknown) => {
    for (const client of clients) {
      client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };
  const table = routes({
    baseUrl: () => baseUrl,
    broadcast,
    loopback,
    options,
    tests: {},
    workspace,
  });

  workspace.onChange((event) => {
    const { type, ...data } = event;
    broadcast(type, data);
  });

  const handle = async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    guardRequest(request, { loopback });

    if (url.pathname === "/api/events") {
      response.writeHead(200, {
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
      });
      response.write(": connected\n\n");
      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }
    if (
      url.pathname === "/llms.txt" ||
      (url.pathname === "/" && prefersMarkdown(request))
    ) {
      const analysis = await workspace.current();
      sendMarkdown(
        response,
        studioMarkdown(baseUrl, path.basename(analysis.project.config.root))
      );
      return;
    }
    if (url.pathname.startsWith("/api")) {
      const route = table[url.pathname];
      const isDefinition = url.pathname.startsWith(DEFINITIONS_PREFIX);
      if (!(route || isDefinition)) {
        throw new HttpError(404, "NOT_FOUND", `No route ${url.pathname}.`);
      }
      const method = route?.method ?? "GET";
      if (request.method !== method) {
        throw new HttpError(
          405,
          "METHOD_NOT_ALLOWED",
          `Use ${method} ${url.pathname}.`
        );
      }
      const result = route
        ? await route.run(request, url)
        : await definitionRoute(workspace, url.pathname);
      if ("markdown" in result) {
        sendMarkdown(response, result.markdown);
      } else {
        sendJson(response, result.status ?? 200, result.json);
      }
      return;
    }
    if (options.apiOnly) {
      throw new HttpError(404, "NOT_FOUND", "Running with --api-only.");
    }
    await serveStatic(options.staticDir, url.pathname, response);
  };

  const server = createServer(async (request, response) => {
    try {
      await handle(request, response);
    } catch (error) {
      const { body, status } = toErrorResponse(error);
      sendJson(response, status, body);
    }
  });

  if (options.watch !== false) {
    workspace.watch();
  }
  server.listen(options.port, options.host);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const host = options.host.includes(":") ? `[${options.host}]` : options.host;
  baseUrl = `http://${host}:${port}`;

  return {
    close: () => {
      workspace.close();
      for (const client of clients) {
        client.end();
      }
      server.close();
    },
    loopback,
    // The bound port, so `port: 0` picks a free one.
    url: baseUrl,
    workspace,
  };
};
