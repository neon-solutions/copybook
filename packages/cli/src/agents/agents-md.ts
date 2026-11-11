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

The code snippets, shell commands, and coding-agent prompts in this product's UI are Copybook definitions, configured in \`${configFile}\`. Before changing one, run \`${runner} status --json\`. After changing one, run \`${runner} snapshot\` and \`${runner} check\`, and commit the snapshots with the code. Markdown prompts from the config's \`markdown\` sources are their own snapshots, so editing one needs no snapshot. The Copybook skill in \`.agents/skills/copybook\` and the \`copybook\` MCP server have the details. Docs for agents: https://copybook.dev/llms.txt
${END}`;

/**
 * Replaces the marked block in `text`, or appends it. Everything outside
 * the markers stays as it is. Only a start/end pair with no other start
 * between them is replaced, so a stray start marker can't swallow user
 * content when a later block is appended.
 */
export const upsertBlock = (text: string | undefined, block: string) => {
  if (text === undefined || text.trim() === "") {
    return `${block}\n`;
  }
  let from = 0;
  while (from < text.length) {
    const start = text.indexOf(START, from);
    if (start === -1) {
      break;
    }
    const afterStart = start + START.length;
    const end = text.indexOf(END, afterStart);
    if (end === -1) {
      break;
    }
    const nextStart = text.indexOf(START, afterStart);
    if (nextStart === -1 || nextStart > end) {
      return `${text.slice(0, start)}${block}${text.slice(end + END.length)}`;
    }
    from = nextStart;
  }
  return `${text.trimEnd()}\n\n${block}\n`;
};
