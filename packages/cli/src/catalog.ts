import type { Command, Option } from "commander";

import { BIN_NAME, DOCS_URL, VERSION } from "./meta";

/** What running a command does to the project or the machine. */
export type CommandEffect =
  | "reads"
  | "runs-agents"
  | "runs-code"
  | "serves"
  | "writes-files"
  | "writes-snapshots";

/**
 * Whether an agent can run it without asking: `safe`, `ask` the user first,
 * or `ci-only`.
 */
export type AgentPolicy = "ask" | "ci-only" | "safe";

interface CommandMeta {
  agent: AgentPolicy;
  effect: CommandEffect;
  examples: string[];
  /** Whether it takes `--json`. */
  json: boolean;
  /** Caveats agents should know. */
  notes?: string;
}

const REFERENCE = `${DOCS_URL}/reference/cli`;

/** What commander can't tell: effects, agent policy, and examples. */
export const COMMAND_META = {
  check: {
    agent: "safe",
    effect: "reads",
    examples: [
      `${BIN_NAME} check`,
      `${BIN_NAME} check --json --base origin/main`,
    ],
    json: true,
  },
  commands: {
    agent: "safe",
    effect: "reads",
    examples: [`${BIN_NAME} commands --json`],
    json: true,
  },
  eval: {
    agent: "ci-only",
    effect: "runs-agents",
    examples: [`CI=true ${BIN_NAME} eval --budget-usd 10`],
    json: true,
    notes:
      "Agents run with their permission prompts bypassed, in a directory that isn't isolated. It refuses to run unless CI=true or --unsafe-local is set.",
  },
  init: {
    agent: "ask",
    effect: "writes-files",
    examples: [`${BIN_NAME} init`, `${BIN_NAME} init --no-install`],
    json: true,
  },
  list: {
    agent: "safe",
    effect: "reads",
    examples: [
      `${BIN_NAME} list --json`,
      `${BIN_NAME} list --grep "npm install"`,
    ],
    json: true,
  },
  report: {
    agent: "safe",
    effect: "reads",
    examples: [`${BIN_NAME} report --base origin/main > report.md`],
    json: false,
  },
  show: {
    agent: "safe",
    effect: "reads",
    examples: [
      `${BIN_NAME} show <id>`,
      `${BIN_NAME} show <id> --text --values '{"projectId":"proj-123"}'`,
    ],
    json: true,
  },
  snapshot: {
    agent: "safe",
    effect: "writes-snapshots",
    examples: [`${BIN_NAME} snapshot`, `${BIN_NAME} snapshot --prune`],
    json: true,
    notes: "--prune deletes snapshot files; ask before using it.",
  },
  status: {
    agent: "safe",
    effect: "reads",
    examples: [`${BIN_NAME} status --json`],
    json: true,
  },
  studio: {
    agent: "ask",
    effect: "serves",
    examples: [`${BIN_NAME} studio`],
    json: false,
  },
  test: {
    agent: "safe",
    effect: "runs-code",
    examples: [
      `${BIN_NAME} test --json`,
      `${BIN_NAME} test --tier syntax,typecheck,run`,
    ],
    json: true,
    notes:
      "The syntax and typecheck tiers are safe. The run tier executes commands for real, with fixtures; ask before running it.",
  },
  usages: {
    agent: "safe",
    effect: "reads",
    examples: [`${BIN_NAME} usages --json`],
    json: true,
  },
} satisfies Record<string, CommandMeta>;

export interface CatalogOption {
  default?: unknown;
  description: string;
  flags: string;
  long?: string;
  /** For `--no-x` flags. */
  negate: boolean;
  short?: string;
  /** Allowed values, when the option restricts them. */
  values?: string[];
  variadic: boolean;
}

export interface CatalogCommand extends CommandMeta {
  arguments: {
    description: string;
    name: string;
    required: boolean;
    variadic: boolean;
  }[];
  docs: string;
  name: string;
  options: CatalogOption[];
  summary: string;
  usage: string;
}

/** Every command and flag, for agents, docs, and the site. */
export interface CommandCatalog {
  bin: string;
  commands: CatalogCommand[];
  docs: string;
  exitCodes: { "0": string; "1": string; "2": string };
  schemaVersion: 1;
  version: string;
}

const toOption = (option: Option): CatalogOption => ({
  description: option.description,
  flags: option.flags,
  negate: option.negate,
  variadic: option.variadic,
  ...(option.defaultValue === undefined
    ? {}
    : { default: option.defaultValue }),
  ...(option.long ? { long: option.long } : {}),
  ...(option.short ? { short: option.short } : {}),
  ...(option.argChoices ? { values: [...option.argChoices] } : {}),
});

const metaFor = (name: string): CommandMeta | undefined =>
  (COMMAND_META as Record<string, CommandMeta>)[name];

/** Describes `program`'s commands from commander plus `COMMAND_META`. */
export const buildCatalog = (program: Command): CommandCatalog => ({
  bin: BIN_NAME,
  commands: program.commands.flatMap((command) => {
    const name = command.name();
    const meta = metaFor(name);
    if (!meta) {
      return [];
    }
    return [
      {
        ...meta,
        arguments: command.registeredArguments.map((argument) => ({
          description: argument.description,
          name: argument.name(),
          required: argument.required,
          variadic: argument.variadic,
        })),
        docs: `${REFERENCE}#${name}`,
        name,
        options: command.options
          .filter((option) => !option.hidden)
          .map(toOption),
        summary: command.description(),
        usage: `${BIN_NAME} ${name} ${command.usage()}`.trim(),
      },
    ];
  }),
  docs: DOCS_URL,
  exitCodes: {
    "0": "Everything is fine.",
    "1": "The command ran and found problems.",
    "2": "The command couldn't run: a usage error, no config, or content that fails to load.",
  },
  schemaVersion: 1,
  version: VERSION,
});
