import { spawn } from "node:child_process";

export interface ExecResult {
  code: number | null;
  durationMs: number;
  output: string;
  stderr: string;
  stdout: string;
  timedOut: boolean;
}

export interface ExecOptions {
  cwd: string;
  env?: Record<string, string | undefined>;
  input?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_OUTPUT = 64 * 1024;

/** Only these variables reach sandboxed processes, plus what a test adds. */
const INHERITED_ENV = [
  "HOME",
  "LANG",
  "PATH",
  "TERM",
  "TMPDIR",
  "USER",
] as const;

export const baseEnv = (): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const name of INHERITED_ENV) {
    const value = process.env[name];
    if (value !== undefined) {
      env[name] = value;
    }
  }
  // npm and pip read their registry settings from these.
  for (const [name, value] of Object.entries(process.env)) {
    const isRegistrySetting = /^(?:npm_config_|NPM_CONFIG_|PIP_|UV_)/u.test(
      name
    );
    if (isRegistrySetting && value !== undefined) {
      env[name] = value;
    }
  }
  return env;
};

const clip = (text: string) =>
  text.length > MAX_OUTPUT
    ? `${text.slice(0, MAX_OUTPUT)}\n… (truncated)`
    : text;

/** Kill the child and any grandchildren started in its process group. */
const killProcessTree = (
  child: ReturnType<typeof spawn>,
  pid: number | undefined
) => {
  if (pid === undefined) {
    child.kill("SIGKILL");
    return;
  }
  if (process.platform === "win32") {
    child.kill("SIGKILL");
    return;
  }
  try {
    // Negative pid targets the process group (child is group leader when
    // spawned with detached: true).
    process.kill(-pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
};

/** Runs a command without a shell, with a timeout and a clean environment. */
export const exec = (
  command: string,
  args: readonly string[],
  { cwd, env, input, timeoutMs = DEFAULT_TIMEOUT_MS }: ExecOptions
): Promise<ExecResult> => {
  const started = performance.now();
  const { promise, resolve } = Promise.withResolvers<ExecResult>();
  // On POSIX, detached makes the child a process-group leader so timeout can
  // SIGKILL the whole tree (grandchildren included). Windows has no equivalent
  // that is safe without extra deps, so fall back to child.kill there.
  const child = spawn(command, args, {
    cwd,
    detached: process.platform !== "win32",
    env: { ...baseEnv(), ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  let output = "";
  let timedOut = false;
  let settled = false;
  const timer = setTimeout(() => {
    timedOut = true;
    killProcessTree(child, child.pid);
  }, timeoutMs);
  const settle = (code: number | null) => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(timer);
    // Grandchildren can keep inherited stdio open after the leader dies;
    // destroy so we never wait forever for a close that will not come.
    child.stdout.destroy();
    child.stderr.destroy();
    child.stdin.destroy();
    resolve({
      code,
      durationMs: performance.now() - started,
      output: clip(output),
      stderr: clip(stderr),
      stdout: clip(stdout),
      timedOut,
    });
  };

  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
    output += chunk.toString();
  });
  child.on("error", (error) => {
    clearTimeout(timer);
    if (settled) {
      return;
    }
    settled = true;
    resolve({
      code: null,
      durationMs: performance.now() - started,
      output: error.message,
      stderr: error.message,
      stdout,
      timedOut,
    });
  });
  // Resolve on exit (not close): close waits for all stdio fds to close, which
  // never happens if a grandchild still holds the pipes open after a timeout.
  child.on("exit", (code) => {
    settle(code);
  });
  // A process that exits before reading its input closes the pipe, so the
  // write fails with EPIPE. Its exit code already says what happened.
  child.stdin.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code !== "EPIPE") {
      output += error.message;
      stderr += error.message;
    }
  });
  child.stdin.end(input ?? "");
  return promise;
};

/** True when `command` can be spawned. */
export const hasCommand = async (
  command: string,
  args: readonly string[] = ["--version"]
) => {
  const result = await exec(command, args, {
    cwd: process.cwd(),
    timeoutMs: 10_000,
  });
  return result.code === 0;
};
