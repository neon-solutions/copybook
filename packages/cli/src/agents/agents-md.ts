const START = "<!-- copybook:start -->";
const END = "<!-- copybook:end -->";

/** The Copybook section of AGENTS.md, between markers so it can update. */
export const renderAgentsBlock = ({
  configFile = "copybook.config.ts",
  runner,
}: {
  /** The config's file name, such as `copybook.config.mjs`. */
  configFile?: string;
  runner: string;
}) => `${START}

## Copybook

The code snippets, shell commands, and coding-agent prompts in this product's UI are Copybook definitions, configured in \`${configFile}\`. Before changing one, run \`${runner} status --json\`. After changing one, run \`${runner} snapshot\` and \`${runner} check\`, and commit the snapshots with the code. The Copybook skill in \`.agents/skills/copybook\` and the \`copybook\` MCP server have the details. Docs for agents: https://copybook.dev/llms.txt
${END}`;

/**
 * Replaces the marked block in `text`, or appends it. Everything outside
 * the markers stays as it is.
 */
export const upsertBlock = (text: string | undefined, block: string) => {
  if (text === undefined || text.trim() === "") {
    return `${block}\n`;
  }
  const start = text.indexOf(START);
  const end = text.indexOf(END, start);
  if (start !== -1 && end !== -1) {
    return `${text.slice(0, start)}${block}${text.slice(end + END.length)}`;
  }
  return `${text.trimEnd()}\n\n${block}\n`;
};
