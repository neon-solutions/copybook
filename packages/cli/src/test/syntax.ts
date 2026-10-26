import { transform } from "esbuild";

import { exec, hasCommand } from "./exec";

export type Check =
  | { message: string; status: "fail" }
  | { reason: string; status: "skip" }
  | { status: "pass" };

const DOTENV_LINE = /^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*=(?<value>.*)$/u;
const QUOTED = /^(?<quote>["'`]).*\k<quote>$/u;

const SHELL = new Set(["bash", "console", "sh", "shell", "zsh"]);
const SCRIPT_LOADERS: Record<string, "js" | "jsx" | "ts" | "tsx"> = {
  javascript: "js",
  js: "js",
  jsx: "jsx",
  mjs: "js",
  ts: "ts",
  tsx: "tsx",
  typescript: "ts",
};

const checkDotenv = (code: string): Check => {
  for (const [index, raw] of code.split("\n").entries()) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const value = DOTENV_LINE.exec(line)?.groups?.value;
    if (value === undefined) {
      return {
        message: `Line ${index + 1} isn't KEY=VALUE: ${raw}`,
        status: "fail",
      };
    }
    const startsQuoted = /^["'`]/u.test(value);
    if (startsQuoted && !QUOTED.test(value)) {
      return {
        message: `Line ${index + 1} has an unclosed quote: ${raw}`,
        status: "fail",
      };
    }
  }
  return { status: "pass" };
};

const checkShell = async (code: string, cwd: string): Promise<Check> => {
  const result = await exec("bash", ["-n"], { cwd, input: code });
  return result.code === 0
    ? { status: "pass" }
    : { message: result.stderr.trim(), status: "fail" };
};

const checkScript = async (
  code: string,
  loader: "js" | "jsx" | "ts" | "tsx"
): Promise<Check> => {
  try {
    await transform(code, { format: "esm", loader, logLevel: "silent" });
    return { status: "pass" };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : String(error),
      status: "fail",
    };
  }
};

let pythonAvailable: Promise<boolean> | undefined;

const checkPython = async (code: string, cwd: string): Promise<Check> => {
  pythonAvailable ??= hasCommand("python3");
  if (!(await pythonAvailable)) {
    return { reason: "python3 isn't installed", status: "skip" };
  }
  const result = await exec(
    "python3",
    ["-c", "import ast, sys; ast.parse(sys.stdin.read())"],
    {
      cwd,
      input: code,
    }
  );
  return result.code === 0
    ? { status: "pass" }
    : { message: result.stderr.trim(), status: "fail" };
};

/** Parses code without running it. Unknown languages are skipped. */
export const checkSyntax = async (
  lang: string | undefined,
  code: string,
  cwd: string
): Promise<Check> => {
  const language = (lang ?? "").toLowerCase();
  if (SHELL.has(language)) {
    return await checkShell(code, cwd);
  }
  const loader = SCRIPT_LOADERS[language];
  if (loader) {
    return await checkScript(code, loader);
  }
  if (language === "dotenv" || language === "env") {
    return checkDotenv(code);
  }
  if (language === "python" || language === "py") {
    return await checkPython(code, cwd);
  }
  if (language === "json") {
    try {
      JSON.parse(code);
      return { status: "pass" };
    } catch (error) {
      return {
        message: error instanceof Error ? error.message : String(error),
        status: "fail",
      };
    }
  }
  return {
    reason: `no syntax checker for "${lang ?? "plain text"}"`,
    status: "skip",
  };
};
