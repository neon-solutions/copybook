/**
 * Something to do next, for people and agents. `argv` is the CLI command
 * without the runner, and `tool` the matching MCP tool, when one exists.
 */
export interface NextAction {
  argv?: string[];
  code: string;
  /** The command to show, such as `copybook snapshot`. */
  command?: string;
  ids?: string[];
  /** Whether an agent can do it without asking. */
  safe: boolean;
  title: string;
  tool?: string;
}
