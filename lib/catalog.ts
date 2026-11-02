import type {
  CatalogCommand,
  CatalogOption,
  CommandCatalog,
} from "@copybook/cli";
import catalog from "@copybook/cli/catalog.json";

/** Every CLI command and flag, from the CLI's own build. */
export const cliCatalog = catalog as CommandCatalog;

export const findCommand = (name: string): CatalogCommand | undefined =>
  cliCatalog.commands.find((command) => command.name === name);

/** Commander's lowercase flag descriptions, as sentences. */
export const sentence = (text: string) =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}${text.endsWith(".") ? "" : "."}`;

/** A flag's description, allowed values, and default, for rendering. */
export const optionParts = (option: CatalogOption) => ({
  description: sentence(option.description),
  ...(option.default === undefined || option.negate
    ? {}
    : { fallback: String(option.default) }),
  ...(option.values ? { values: option.values } : {}),
});

const code = (value: string) => `\`${value}\``;

/** The description of a flag, with its default and allowed values. */
export const describeOption = (option: CatalogOption) => {
  const { description, fallback, values } = optionParts(option);
  return [
    description,
    values ? `One of ${values.map(code).join(", ")}.` : "",
    fallback === undefined ? "" : `Defaults to ${code(fallback)}.`,
  ]
    .filter(Boolean)
    .join(" ");
};

/** A command's flags as a Markdown table, for agents. */
export const optionsMarkdown = (name: string) => {
  const command = findCommand(name);
  if (!command) {
    return "";
  }
  return [
    "| Flag | Description |",
    "| --- | --- |",
    ...command.options.map(
      (option) =>
        `| \`${option.flags}\` | ${describeOption(option).replaceAll("|", "\\|")} |`
    ),
  ].join("\n");
};

export const POLICY_LABELS = {
  ask: "ask first",
  "ci-only": "CI only",
  safe: "agents can run it",
} as const;

/** Every command as a Markdown list, for index.md and llms.txt. */
export const commandsMarkdown = () =>
  cliCatalog.commands
    .map(
      (command) =>
        `- \`${command.usage}\` (${POLICY_LABELS[command.agent]}): ${sentence(command.summary)}${command.notes ? ` ${command.notes}` : ""}`
    )
    .join("\n");
