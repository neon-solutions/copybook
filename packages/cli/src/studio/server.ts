import { once } from "node:events";
import { existsSync, watch } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

import { createStudioState } from "./state";
import type { StudioState } from "./state";

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const IGNORED_SEGMENTS = new Set([".git", ".next", "dist", "node_modules"]);
const RELOAD_DEBOUNCE_MS = 150;

export interface StudioOptions {
  /** Serve only `/api`, for developing the Studio UI with Vite. */
  apiOnly?: boolean;
  config?: string;
  cwd: string;
  host: string;
  port: number;
  /** The built Studio UI. */
  staticDir: string;
}

const sendJson = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { "Content-Type": CONTENT_TYPES[".json"] });
  response.end(JSON.stringify(body));
};

const readBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf-8");
  return text === "" ? {} : JSON.parse(text);
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

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

interface RenderBody {
  id?: string;
  values?: Record<string, unknown>;
  variant?: string;
}

const handleApi = async (
  state: StudioState,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL
) => {
  if (url.pathname === "/api/manifest") {
    sendJson(response, 200, state.manifest());
    return;
  }
  if (url.pathname === "/api/results") {
    sendJson(response, 200, await state.results());
    return;
  }
  if (url.pathname === "/api/history") {
    sendJson(
      response,
      200,
      await state.history(url.searchParams.get("id") ?? "")
    );
    return;
  }
  if (url.pathname === "/api/render" && request.method === "POST") {
    const body = (await readBody(request)) as RenderBody;
    sendJson(
      response,
      200,
      state.render(body.id ?? "", body.values ?? {}, body.variant)
    );
    return;
  }
  sendJson(response, 404, { error: "Not found" });
};

/** Starts Studio: the JSON API plus the prebuilt UI, with live reload. */
export const startStudio = async (options: StudioOptions) => {
  const state = await createStudioState(options.cwd, options);
  const clients = new Set<ServerResponse>();
  const broadcast = (event: string, data: unknown) => {
    for (const client of clients) {
      client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    try {
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
      if (url.pathname.startsWith("/api/")) {
        await handleApi(state, request, response, url);
        return;
      }
      if (options.apiOnly) {
        sendJson(response, 404, { error: "Running with --api-only" });
        return;
      }
      await serveStatic(options.staticDir, url.pathname, response);
    } catch (error) {
      sendJson(response, 500, { error: errorMessage(error) });
    }
  });

  let timer: NodeJS.Timeout | undefined;
  const watcher = watch(
    state.project().config.root,
    { recursive: true },
    (_event, file) => {
      const segments = String(file ?? "").split(path.sep);
      if (segments.some((segment) => IGNORED_SEGMENTS.has(segment))) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          await state.reload();
          broadcast("change", { loadedAt: state.manifest().loadedAt });
        } catch (error) {
          broadcast("error", { message: errorMessage(error) });
        }
      }, RELOAD_DEBOUNCE_MS);
    }
  );

  server.listen(options.port, options.host);
  await once(server, "listening");

  return {
    close: () => {
      watcher.close();
      for (const client of clients) {
        client.end();
      }
      server.close();
    },
    // The bound port, so `port: 0` picks a free one.
    url: `http://${options.host}:${(server.address() as AddressInfo).port}`,
  };
};
