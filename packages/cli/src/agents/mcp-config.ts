import type { PackageManager } from "../package-manager";

export interface McpServerEntry {
  args: string[];
  command: string;
}

const LAUNCHERS: Record<PackageManager, McpServerEntry> = {
  bun: { args: ["copybook", "mcp"], command: "bunx" },
  // --no keeps npx from prompting to install, which would hang the server.
  npm: { args: ["--no", "copybook", "mcp"], command: "npx" },
  pnpm: { args: ["exec", "copybook", "mcp"], command: "pnpm" },
  yarn: { args: ["copybook", "mcp"], command: "yarn" },
};

/** How an MCP client starts `copybook mcp` in this project. */
export const mcpServerEntry = ({
  manager,
  platform,
}: {
  manager: PackageManager;
  platform: NodeJS.Platform;
}): McpServerEntry => {
  const launcher = LAUNCHERS[manager];
  // Windows can't spawn npx or pnpm directly; they're .cmd scripts.
  return platform === "win32"
    ? { args: ["/c", launcher.command, ...launcher.args], command: "cmd" }
    : launcher;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Adds the `copybook` server to an MCP config's `key` (`mcpServers`, or
 * `servers` for VS Code), keeping every other server. Returns undefined
 * when the file isn't strict JSON, so it can be left alone.
 */
export const mergeMcpConfig = (
  text: string | undefined,
  key: "mcpServers" | "servers",
  entry: Record<string, unknown>
): string | undefined => {
  let config: Record<string, unknown> = {};
  if (text !== undefined && text.trim() !== "") {
    try {
      const parsed: unknown = JSON.parse(text);
      if (!isRecord(parsed)) {
        return undefined;
      }
      config = parsed;
    } catch {
      return undefined;
    }
  }
  const servers = config[key];
  if (servers !== undefined && !isRecord(servers)) {
    return undefined;
  }
  return `${JSON.stringify(
    { ...config, [key]: { ...servers, copybook: entry } },
    null,
    2
  )}\n`;
};
