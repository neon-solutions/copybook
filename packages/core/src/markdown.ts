import type { CodeNode, Node } from "./nodes";
import { toText } from "./text";

const OPEN = /^(?<indent>[ \t]*)(?<fence>`{3,}|~{3,})(?<info>.*)$/u;
const CLOSE = /^[ \t]*(?<fence>`{3,}|~{3,})[ \t]*$/u;
const INFO = /^(?<lang>[^\s`]+)(?: (?<meta>\S.*))?$/u;

interface Fence {
  fence: string;
  indent: string;
  info: string;
}

const render = (nodes: Node[]) => toText({ id: "", kind: "prompt", nodes });

/** The fence a line opens, if any. Backtick fences can't have backticks after them. */
const openingFence = (line: string): Fence | undefined => {
  const groups = OPEN.exec(line)?.groups;
  const fence = groups?.fence ?? "";
  const info = groups?.info ?? "";
  if (!groups || (fence.startsWith("`") && info.includes("`"))) {
    return;
  }
  return { fence, indent: groups.indent ?? "", info };
};

/** The index of the line that closes the fence, or `lines.length`. */
const closingLine = (lines: readonly string[], start: number, open: Fence) => {
  for (let end = start; end < lines.length; end += 1) {
    const fence = CLOSE.exec(lines[end] ?? "")?.groups?.fence ?? "";
    if (fence[0] === open.fence[0] && fence.length >= open.fence.length) {
      return end;
    }
  }
  return lines.length;
};

/** A code node for a block's lines, or nothing if it can't hold them. */
const codeNode = (
  { indent, info }: Fence,
  lines: readonly string[]
): CodeNode | undefined => {
  const parts = INFO.exec(info)?.groups;
  if (info !== "" && !parts) {
    return;
  }
  if (lines.some((line) => line !== "" && !line.startsWith(indent))) {
    return;
  }
  const body = lines.map((line) => line.slice(indent.length)).join("\n");
  const node: CodeNode = {
    children: body === "" ? [] : [{ type: "text", value: body }],
    type: "code",
  };
  if (parts?.lang) {
    node.lang = parts.lang;
  }
  if (parts?.meta) {
    node.meta = parts.meta;
  }
  return node;
};

interface Block {
  end: number;
  node?: CodeNode;
  source: string;
}

/** A fenced block, with a code node when that renders back to its source. */
const readBlock = (
  lines: readonly string[],
  start: number,
  open: Fence
): Block => {
  const end = closingLine(lines, start + 1, open);
  const source = lines.slice(start, end + 1).join("\n");
  const node =
    end < lines.length && open.fence === "```"
      ? codeNode(open, lines.slice(start + 1, end))
      : undefined;
  const indent: Node = { type: "text", value: open.indent };
  return node && render([indent, node]) === source
    ? { end, node, source }
    : { end, source };
};

/**
 * Splits Markdown into text and code nodes. A fenced block becomes a code
 * node only when rendering it gives back the exact source, so the rendered
 * text always equals the Markdown, byte for byte.
 */
export const parseMarkdown = (markdown: string): Node[] => {
  const lines = markdown.split("\n");
  const nodes: Node[] = [];
  let text = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const open = openingFence(line);
    let end = index;
    if (open) {
      const block = readBlock(lines, index, open);
      ({ end } = block);
      if (block.node) {
        text += open.indent;
        if (text !== "") {
          nodes.push({ type: "text", value: text });
        }
        nodes.push(block.node);
        text = "";
      } else {
        text += block.source;
      }
    } else {
      text += line;
    }
    if (end < lines.length - 1) {
      text += "\n";
    }
    index = end;
  }
  if (text !== "") {
    nodes.push({ type: "text", value: text });
  }

  return render(nodes) === markdown
    ? nodes
    : [{ type: "text", value: markdown }];
};
