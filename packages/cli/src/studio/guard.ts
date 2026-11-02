import type { IncomingMessage } from "node:http";

import { CopybookError } from "../errors";
import type { NextAction } from "../next-actions";

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);
const MAX_BODY_BYTES = 1024 * 1024;

export type StudioErrorCode =
  | "BAD_JSON"
  | "BUSY"
  | "FORBIDDEN_HOST"
  | "FORBIDDEN_ORIGIN"
  | "METHOD_NOT_ALLOWED"
  | "NOT_FOUND"
  | "PAYLOAD_TOO_LARGE"
  | "READ_ONLY"
  | "UNSUPPORTED_MEDIA_TYPE";

/** An API failure with its HTTP status. */
export class HttpError extends Error {
  readonly code: string;
  readonly next: NextAction[];
  readonly status: number;

  constructor(
    status: number,
    code: StudioErrorCode,
    message: string,
    next: NextAction[] = []
  ) {
    super(message);
    this.name = "HttpError";
    this.code = code;
    this.next = next;
    this.status = status;
  }
}

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_OPTION: 400,
  INVALID_VALUES: 422,
  UNKNOWN_ID: 404,
};

/** The status and body for any error the API throws. */
export const toErrorResponse = (error: unknown) => {
  if (error instanceof HttpError || error instanceof CopybookError) {
    const status =
      error instanceof HttpError
        ? error.status
        : (STATUS_BY_CODE[error.code] ?? 500);
    return {
      body: {
        error: { code: error.code, message: error.message },
        next: error.next,
      },
      status,
    };
  }
  return {
    body: {
      error: {
        code: "INTERNAL",
        message: error instanceof Error ? error.message : String(error),
      },
      next: [],
    },
    status: 500,
  };
};

export const isLoopback = (host: string) => LOOPBACK_HOSTNAMES.has(host);

const hostnameOf = (value: string) => {
  try {
    return new URL(`http://${value}`).hostname;
  } catch {
    return "";
  }
};

const isLoopbackOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      isLoopback(url.hostname)
    );
  } catch {
    return false;
  }
};

/**
 * Rejects requests a browser page on another site could send. When Studio
 * listens on loopback, the Host header must name a loopback host on any
 * port, which blocks DNS rebinding and allows the Vite dev proxy. POSTs
 * must be JSON, which forces a CORS preflight that Studio never answers,
 * and must come from a loopback page, if from a page at all.
 */
export const guardRequest = (
  request: IncomingMessage,
  options: { loopback: boolean }
) => {
  if (options.loopback && !isLoopback(hostnameOf(request.headers.host ?? ""))) {
    throw new HttpError(
      403,
      "FORBIDDEN_HOST",
      "Studio only answers requests for localhost."
    );
  }
  if (request.method !== "POST") {
    return;
  }
  const type = request.headers["content-type"] ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Send POST bodies as Content-Type: application/json."
    );
  }
  const { origin } = request.headers;
  const site = request.headers["sec-fetch-site"];
  if (
    (origin !== undefined && !isLoopbackOrigin(origin)) ||
    (site !== undefined && site !== "same-origin" && site !== "none")
  ) {
    throw new HttpError(
      403,
      "FORBIDDEN_ORIGIN",
      "Studio only accepts POSTs from its own pages and local tools."
    );
  }
};

/** Reads a JSON object body of at most 1 MB. */
export const readJsonBody = async (
  request: IncomingMessage
): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpError(
        413,
        "PAYLOAD_TOO_LARGE",
        "Request bodies are limited to 1 MB."
      );
    }
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf-8");
  if (text === "") {
    return {};
  }
  try {
    const body: unknown = JSON.parse(text);
    if (typeof body === "object" && body !== null && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    // Reported below.
  }
  throw new HttpError(400, "BAD_JSON", "The body must be a JSON object.");
};
