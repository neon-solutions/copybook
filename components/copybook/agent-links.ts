export type AgentId = "claude-code" | "codex" | "cursor";

interface AgentTarget {
  label: string;
  /** The link for `text`, or nothing when the agent can't take it. */
  link: (text: string) => string | undefined;
}

/** Cursor documents 8,000 to 10,000 characters for the whole encoded URL. */
const CURSOR_MAX_URL = 8000;
/** Claude Code caps `q` at 5,000 characters. */
const CLAUDE_CODE_MAX_TEXT = 5000;
/** Codex doesn't document a limit, so it gets Cursor's. */
const CODEX_MAX_URL = 8000;

const withinUrl = (url: string, max: number) =>
  url.length <= max ? url : undefined;

export const AGENTS: Record<AgentId, AgentTarget> = {
  "claude-code": {
    label: "Claude Code",
    link: (text) =>
      text.length <= CLAUDE_CODE_MAX_TEXT
        ? `claude-cli://open?q=${encodeURIComponent(text)}`
        : undefined,
  },
  codex: {
    label: "Codex",
    link: (text) =>
      withinUrl(
        `codex://new?prompt=${encodeURIComponent(text)}`,
        CODEX_MAX_URL
      ),
  },
  // The web link works without the app: cursor.com offers to open it.
  cursor: {
    label: "Cursor",
    link: (text) =>
      withinUrl(
        `https://cursor.com/link/prompt?text=${encodeURIComponent(text)}`,
        CURSOR_MAX_URL
      ),
  },
};
