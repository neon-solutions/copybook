import type { Node, Rendered } from "./nodes";

export type TextFormat = "markdown" | "plain";

/** A flat run of text, ready to show in a UI or join into a string. */
export interface Segment {
  /** The nearest enclosing command or code block. */
  in?: "code" | "command";
  /** The definition this text came from, when it was embedded. */
  id?: string;
  lang?: string;
  /** The param name, for `param` segments. */
  name?: string;
  placeholder?: true;
  secret?: true;
  text: string;
  type: "fence" | "param" | "text";
}

const LEADING_WHITESPACE = /^[ \t]*/u;

const currentLine = (output: string) =>
  output.slice(output.lastIndexOf("\n") + 1);

/** Longest run of backticks in `text`, for sizing Markdown fences. */
const longestBacktickRun = (text: string): number => {
  let longest = 0;
  let run = 0;
  for (const char of text) {
    if (char === "`") {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  return longest;
};

const fenceFor = (content: string) =>
  "`".repeat(Math.max(3, longestBacktickRun(content) + 1));

/**
 * Flattened text of a subtree, used only to size fences. Nested code blocks
 * count with the fences they'll get, so an outer fence outgrows them.
 */
const flatText = (nodes: readonly Node[]): string => {
  let text = "";
  for (const node of nodes) {
    if (node.type === "text" || node.type === "param") {
      text += node.value;
    } else if (node.type === "code") {
      const inner = flatText(node.children);
      const fence = fenceFor(inner);
      text += `${fence}${inner}${fence}`;
    } else {
      text += flatText(node.children);
    }
  }
  return text;
};

interface WalkState {
  /** The last fence pushed was a closing one that still needs its newline. */
  closedFence: boolean;
  format: TextFormat;
  output: string;
  segments: Segment[];
}

/**
 * Indents every line after the first. Blank lines stay empty, except a
 * trailing one, because the next segment continues it.
 */
const indentLines = (text: string, indent: string) => {
  if (indent === "") {
    return text;
  }
  const lines = text.split("\n");
  return lines
    .map((line, index) => {
      const isLast = index === lines.length - 1;
      return index === 0 || (line === "" && !isLast) ? line : indent + line;
    })
    .join("\n");
};

const push = (state: WalkState, segment: Segment, indent: string) => {
  const text = indentLines(segment.text, indent);
  if (text === "") {
    return;
  }
  // Text that continues a closing fence's line moves to its own line.
  const last = state.segments.at(-1);
  if (state.closedFence && last && !text.startsWith("\n")) {
    last.text += "\n";
    state.output += "\n";
  }
  state.closedFence = false;
  state.segments.push({ ...segment, text });
  state.output += text;
};

type Walk = (
  state: WalkState,
  nodes: readonly Node[],
  indent: string,
  context: Pick<Segment, "id" | "in">
) => void;

const walkCode = (
  state: WalkState,
  node: Extract<Node, { type: "code" }>,
  context: Pick<Segment, "id" | "in">,
  recurse: Walk
) => {
  const line = currentLine(state.output);
  const lineIndent = LEADING_WHITESPACE.exec(line)?.[0] ?? "";
  const inner = { id: node.id ?? context.id, in: "code" as const };
  const lang = node.lang ? { lang: node.lang } : {};

  if (state.format === "plain") {
    recurse(state, node.children, lineIndent, inner);
    return;
  }
  // Fences must start on their own line.
  if (line.trim() !== "") {
    push(state, { ...context, text: `\n${lineIndent}`, type: "text" }, "");
  }
  const fence = fenceFor(flatText(node.children));
  push(
    state,
    {
      ...inner,
      ...lang,
      text: `${fence}${node.lang ?? ""}${node.meta ? ` ${node.meta}` : ""}\n`,
      type: "fence",
    },
    lineIndent
  );
  recurse(state, node.children, lineIndent, inner);
  push(
    state,
    { ...inner, ...lang, text: `\n${fence}`, type: "fence" },
    lineIndent
  );
  state.closedFence = true;
};

const walk: Walk = (state, nodes, indent, context) => {
  for (const node of nodes) {
    switch (node.type) {
      case "text": {
        push(state, { ...context, text: node.value, type: "text" }, indent);
        break;
      }
      case "param": {
        const { type: _type, value, ...param } = node;
        push(
          state,
          { ...context, ...param, text: value, type: "param" },
          indent
        );
        break;
      }
      case "command": {
        const childIndent =
          LEADING_WHITESPACE.exec(currentLine(state.output))?.[0] ?? "";
        walk(state, node.children, childIndent, {
          id: node.id ?? context.id,
          in: "command",
        });
        break;
      }
      case "include": {
        const childIndent =
          LEADING_WHITESPACE.exec(currentLine(state.output))?.[0] ?? "";
        walk(state, node.children, childIndent, { ...context, id: node.id });
        break;
      }
      case "code": {
        walkCode(state, node, context, walk);
        break;
      }
      default: {
        break;
      }
    }
  }
};

/**
 * Flattens a rendered tree into segments. Multi-line embeds are indented to
 * the column of the line they start on. In `markdown`, embedded code blocks
 * get fences.
 */
export const toSegments = (
  rendered: Rendered,
  options: { format?: TextFormat } = {}
): Segment[] => {
  const state: WalkState = {
    closedFence: false,
    format: options.format ?? "markdown",
    output: "",
    segments: [],
  };
  walk(state, rendered.nodes, "", {});
  return state.segments;
};

/** The text users copy. Prompts default to Markdown. */
export const toText = (
  rendered: Rendered,
  options: { format?: TextFormat } = {}
): string =>
  toSegments(rendered, options)
    .map((segment) => segment.text)
    .join("");

const plainText = (nodes: readonly Node[]): string =>
  toText({ id: "", kind: "command", nodes: [...nodes] }, { format: "plain" });

export interface EmbeddedCommand {
  id?: string;
  text: string;
}

/** Every command in a rendered tree, in order. Test runners use this. */
export const collectCommands = (rendered: Rendered): EmbeddedCommand[] => {
  const commands: EmbeddedCommand[] = [];
  const visit = (nodes: readonly Node[]) => {
    for (const node of nodes) {
      if (node.type === "command") {
        commands.push({
          text: plainText(node.children),
          ...(node.id ? { id: node.id } : {}),
        });
      } else if (node.type === "code" || node.type === "include") {
        visit(node.children);
      }
    }
  };
  visit(rendered.nodes);
  return commands;
};

/** The ids of every definition embedded in a rendered tree. */
export const collectEmbeds = (rendered: Rendered): string[] => {
  const ids = new Set<string>();
  const visit = (nodes: readonly Node[]) => {
    for (const node of nodes) {
      if (node.type === "text" || node.type === "param") {
        continue;
      }
      if (node.id) {
        ids.add(node.id);
      }
      visit(node.children);
    }
  };
  visit(rendered.nodes);
  return [...ids];
};
