import type { Rendered } from "./nodes";
import { toSegments } from "./text";
import type { Segment } from "./text";

export interface TextInline {
  text: string;
  type: "text";
}

export interface ParamInline {
  name: string;
  /** Set when a secret had no value and rendered as its placeholder. */
  placeholder?: true;
  secret?: true;
  text: string;
  type: "param";
}

/** Text that keeps its params, used inside code. */
export type CodeContent = ParamInline | TextInline;

export interface InlineCode {
  children: CodeContent[];
  /** Set when the code is an embedded command. */
  command?: true;
  /** The command definition's id, if it came from one. */
  id?: string;
  type: "inlineCode";
}

export interface StrongInline {
  children: Inline[];
  type: "strong";
}

export interface EmphasisInline {
  children: Inline[];
  type: "emphasis";
}

export interface LinkInline {
  children: Inline[];
  href: string;
  type: "link";
}

/** Inline content of a block. */
export type Inline =
  | EmphasisInline
  | InlineCode
  | LinkInline
  | ParamInline
  | StrongInline
  | TextInline;

export interface HeadingBlock {
  children: Inline[];
  level: 1 | 2 | 3 | 4 | 5 | 6;
  type: "heading";
}

export interface ParagraphBlock {
  children: Inline[];
  type: "paragraph";
}

export interface ListItem {
  children: Block[];
}

export interface ListBlock {
  items: ListItem[];
  ordered: boolean;
  /** The first number of an ordered list. */
  start?: number;
  type: "list";
}

export interface CodeBlock {
  children: CodeContent[];
  /** The snippet definition's id, if it came from one. */
  id?: string;
  lang?: string;
  /** The rest of the fence's info string, such as `title="db.ts"`. */
  meta?: string;
  type: "code";
}

/** An embedded command on lines of its own. */
export interface CommandBlock {
  children: CodeContent[];
  /** The command definition's id, if it came from one. */
  id?: string;
  type: "command";
}

export interface BlockquoteBlock {
  children: Block[];
  type: "blockquote";
}

export interface ThematicBreakBlock {
  type: "thematicBreak";
}

/** A block of rendered Markdown, ready to draw as HTML. */
export type Block =
  | BlockquoteBlock
  | CodeBlock
  | CommandBlock
  | HeadingBlock
  | ListBlock
  | ParagraphBlock
  | ThematicBreakBlock;

/** One line of segments. Segment text never contains a line break. */
type Line = Segment[];

const LINE_BREAK = /\r?\n/u;
const LEADING_WHITESPACE = /^[ \t]*/u;
const TRAILING_WHITESPACE = /[ \t]*$/u;
const FENCE_OPEN = /^(?<indent> {0,3})(?<fence>`{3,}|~{3,})(?<info>.*)$/u;
const FENCE_CLOSE = /^ {0,3}(?<fence>`{3,}|~{3,})[ \t]*$/u;
const INFO = /^(?<lang>\S+)(?:\s+(?<meta>\S.*))?$/u;
const ATX_HEADING = /^ {0,3}(?<marks>#{1,6})(?:[ \t]+|$)/u;
const CLOSING_HASHES = /(?:^|[ \t]+)#+[ \t]*$/u;
const SETEXT_UNDERLINE = /^ {0,3}(?<mark>=+|-+)[ \t]*$/u;
const THEMATIC_BREAK = /^ {0,3}(?<mark>[-*_])(?:[ \t]*\k<mark>){2,}[ \t]*$/u;
const BLOCKQUOTE = /^ {0,3}> ?/u;
const LIST_MARKER =
  /^(?<indent> {0,3})(?<marker>[-*+]|(?<number>\d{1,9})(?<delimiter>[.)]))(?<space>[ \t]+|$)/u;
const FRONTMATTER_OPEN = /^---[ \t]*$/u;
const FRONTMATTER_CLOSE = /^(?:---|\.\.\.)[ \t]*$/u;
const ASCII_PUNCTUATION = /^[!-/:-@[-`{-~]$/u;
const ALPHANUMERIC = /^[\p{L}\p{N}]$/u;
const WHITESPACE = /^\s$/u;
const URL_SCHEME = /^(?<scheme>[a-z][a-z\d+.-]*):/iu;
const BARE_URL = /^https?:\/\/\S/u;
const URL_TRAILING_PUNCTUATION = /[.,;:!?'"]$/u;
const SAFE_SCHEMES = new Set(["http", "https", "mailto"]);
const DELIMITERS = new Set(["*", "_", "`"]);
/** More spaces than this after a list marker start indented code instead. */
const MAX_MARKER_SPACES = 4;

const lineText = (line: Line) => line.map((segment) => segment.text).join("");

const isBlank = (line: Line) => lineText(line).trim() === "";

const indentOf = (line: Line) =>
  LEADING_WHITESPACE.exec(lineText(line))?.[0].length ?? 0;

const toLines = (segments: readonly Segment[]): Line[] => {
  let current: Line = [];
  const lines: Line[] = [current];
  for (const segment of segments) {
    for (const [index, text] of segment.text.split(LINE_BREAK).entries()) {
      if (index > 0) {
        current = [];
        lines.push(current);
      }
      if (text !== "") {
        current.push({ ...segment, text });
      }
    }
  }
  return lines;
};

/** The line without its first `count` characters. */
const dropStart = (line: Line, count: number): Line => {
  const result: Line = [];
  let remaining = count;
  for (const segment of line) {
    if (remaining >= segment.text.length) {
      remaining -= segment.text.length;
      continue;
    }
    result.push(
      remaining > 0
        ? { ...segment, text: segment.text.slice(remaining) }
        : segment
    );
    remaining = 0;
  }
  return result;
};

/** The first `count` characters of the line. */
const takeStart = (line: Line, count: number): Line => {
  const result: Line = [];
  let remaining = count;
  for (const segment of line) {
    if (remaining <= 0) {
      break;
    }
    result.push(
      segment.text.length > remaining
        ? { ...segment, text: segment.text.slice(0, remaining) }
        : segment
    );
    remaining -= segment.text.length;
  }
  return result;
};

const trimLine = (line: Line): Line => {
  const text = lineText(line);
  const end = text.length - (TRAILING_WHITESPACE.exec(text)?.[0].length ?? 0);
  return dropStart(takeStart(line, end), indentOf(line));
};

/** True when every visible character of the line is an embedded command. */
const isCommandLine = (line: Line) => {
  const visible = line.filter((segment) => segment.text.trim() !== "");
  return (
    visible.length > 0 && visible.every((segment) => segment.in === "command")
  );
};

const commandId = (line: Line) =>
  line.find((segment) => segment.in === "command")?.id;

/** Appends an inline, merging it into the text before it. */
const append = <T extends Inline>(target: T[], item: T) => {
  const last: Inline | undefined = target.at(-1);
  const next: Inline = item;
  if (next.type === "text" && last?.type === "text") {
    last.text += next.text;
    return;
  }
  target.push(item);
};

const toCodeContent = (segment: Segment): CodeContent => {
  if (segment.type !== "param") {
    return { text: segment.text, type: "text" };
  }
  return {
    name: segment.name ?? "",
    text: segment.text,
    type: "param",
    ...(segment.placeholder ? { placeholder: true } : {}),
    ...(segment.secret ? { secret: true } : {}),
  };
};

const codeContent = (lines: readonly Line[]): CodeContent[] => {
  const content: CodeContent[] = [];
  for (const [index, line] of lines.entries()) {
    if (index > 0) {
      append(content, { text: "\n", type: "text" });
    }
    for (const segment of line) {
      append(content, toCodeContent(segment));
    }
  }
  return content;
};

// Inline parsing works on atoms: the characters of Markdown text, plus params
// and embedded commands, which are never read as Markdown.

type Atom =
  | { char: string; kind: "char" }
  | { kind: "command"; segments: Segment[] }
  | { kind: "param"; segment: Segment };

type ParseInline = (atoms: readonly Atom[]) => Inline[];

interface Parsed<T> {
  end: number;
  node: T;
}

const toAtoms = (segments: readonly Segment[]): Atom[] => {
  const atoms: Atom[] = [];
  for (const segment of segments) {
    const last = atoms.at(-1);
    if (segment.in !== "command" && segment.type === "param") {
      atoms.push({ kind: "param", segment });
    } else if (segment.in !== "command") {
      for (const char of segment.text) {
        atoms.push({ char, kind: "char" });
      }
    } else if (
      last?.kind === "command" &&
      last.segments[0]?.id === segment.id
    ) {
      last.segments.push(segment);
    } else {
      atoms.push({ kind: "command", segments: [segment] });
    }
  }
  return atoms;
};

const charAt = (atoms: readonly Atom[], index: number) => {
  const atom = atoms[index];
  return atom?.kind === "char" ? atom.char : undefined;
};

const runLength = (atoms: readonly Atom[], index: number, char: string) => {
  let end = index;
  while (charAt(atoms, end) === char) {
    end += 1;
  }
  return end - index;
};

/** Whitespace, or past either end. Params and commands count as text. */
const isSpaceAt = (atoms: readonly Atom[], index: number) => {
  const char = charAt(atoms, index);
  if (char === undefined) {
    return index < 0 || index >= atoms.length;
  }
  return WHITESPACE.test(char);
};

const isAlphanumericAt = (atoms: readonly Atom[], index: number) =>
  ALPHANUMERIC.test(charAt(atoms, index) ?? "");

const atomText = (atom: Atom) => {
  if (atom.kind === "char") {
    return atom.char;
  }
  if (atom.kind === "param") {
    return atom.segment.text;
  }
  return atom.segments.map((segment) => segment.text).join("");
};

const atomsToCode = (atoms: readonly Atom[]): CodeContent[] => {
  const content: CodeContent[] = [];
  for (const atom of atoms) {
    const segments = atom.kind === "command" ? atom.segments : [];
    if (atom.kind === "char") {
      // Line breaks in inline code read as spaces.
      const text = atom.char === "\n" ? " " : atom.char;
      append(content, { text, type: "text" });
    } else if (atom.kind === "param") {
      append(content, toCodeContent(atom.segment));
    }
    for (const segment of segments) {
      append(content, toCodeContent(segment));
    }
  }
  return content;
};

/** Drops one space from each end of inline code, as Markdown does. */
const stripCodePadding = (content: CodeContent[]): CodeContent[] => {
  const [first] = content;
  const last = content.at(-1);
  const isPadded =
    first?.type === "text" &&
    last?.type === "text" &&
    first.text.startsWith(" ") &&
    last.text.endsWith(" ") &&
    content.some((item) => item.text.trim() !== "");
  if (!isPadded) {
    return content;
  }
  if (first === last) {
    return [{ text: first.text.slice(1, -1), type: "text" }];
  }
  const trimmed: CodeContent[] = [
    { text: first.text.slice(1), type: "text" },
    ...content.slice(1, -1),
    { text: last.text.slice(0, -1), type: "text" },
  ];
  return trimmed.filter((item) => item.text !== "");
};

const codeSpanAt = (
  atoms: readonly Atom[],
  start: number
): Parsed<InlineCode> | undefined => {
  const size = runLength(atoms, start, "`");
  let index = start + size;
  while (index < atoms.length) {
    const run = runLength(atoms, index, "`");
    if (run === size) {
      const body = atomsToCode(atoms.slice(start + size, index));
      return {
        end: index + size,
        node: { children: stripCodePadding(body), type: "inlineCode" },
      };
    }
    index += Math.max(run, 1);
  }
  return undefined;
};

/** The index after the atom at `index`, skipping a whole code span. */
const skipAt = (atoms: readonly Atom[], index: number) => {
  if (charAt(atoms, index) !== "`") {
    return index + 1;
  }
  return codeSpanAt(atoms, index)?.end ?? index + runLength(atoms, index, "`");
};

/** `*emphasis*`, `**strong**`, and their underscore forms. */
const emphasisAt = (
  atoms: readonly Atom[],
  start: number,
  char: string,
  parse: ParseInline
): Parsed<EmphasisInline | StrongInline> | undefined => {
  const run = runLength(atoms, start, char);
  const size = Math.min(run, 2);
  const opens =
    !isSpaceAt(atoms, start + run) &&
    (char !== "_" || !isAlphanumericAt(atoms, start - 1));
  if (!opens) {
    return undefined;
  }
  const contentStart = start + size;
  let index = contentStart;
  while (index < atoms.length) {
    const closingRun = runLength(atoms, index, char);
    const closes =
      closingRun >= size &&
      index > contentStart &&
      !isSpaceAt(atoms, index - 1) &&
      (char !== "_" || !isAlphanumericAt(atoms, index + closingRun));
    if (closes) {
      const close = index + closingRun - size;
      const children = parse(atoms.slice(contentStart, close));
      const type = size === 2 ? "strong" : "emphasis";
      return { end: close + size, node: { children, type } };
    }
    index = closingRun > 0 ? index + closingRun : skipAt(atoms, index);
  }
  return undefined;
};

const isSafeHref = (href: string) => {
  const scheme = URL_SCHEME.exec(href)?.groups?.scheme;
  return scheme === undefined || SAFE_SCHEMES.has(scheme.toLowerCase());
};

/** The index of the bracket that closes the one at `start`, or -1. */
const closingBracket = (atoms: readonly Atom[], start: number) => {
  let depth = 0;
  let index = start;
  while (index < atoms.length) {
    const char = charAt(atoms, index);
    depth += Number(char === "[") - Number(char === "]");
    if (depth === 0) {
      return index;
    }
    index = skipAt(atoms, index);
  }
  return -1;
};

/** The index of the parenthesis that closes the one at `start`, or -1. */
const closingParen = (atoms: readonly Atom[], start: number) => {
  let depth = 0;
  for (let index = start; index < atoms.length; index += 1) {
    if (isSpaceAt(atoms, index)) {
      return -1;
    }
    const char = charAt(atoms, index);
    depth += Number(char === "(") - Number(char === ")");
    if (depth === 0) {
      return index;
    }
  }
  return -1;
};

/** Links can't hold links, so a nested one keeps only its label. */
const unlink = (inlines: Inline[]): Inline[] =>
  inlines.flatMap((inline) =>
    inline.type === "link" ? inline.children : [inline]
  );

/** `[label](href)`. */
const linkAt = (
  atoms: readonly Atom[],
  start: number,
  parse: ParseInline
): Parsed<LinkInline> | undefined => {
  const labelEnd = closingBracket(atoms, start);
  if (labelEnd < 0 || charAt(atoms, labelEnd + 1) !== "(") {
    return undefined;
  }
  const hrefEnd = closingParen(atoms, labelEnd + 1);
  const href = atoms
    .slice(labelEnd + 2, hrefEnd)
    .map(atomText)
    .join("");
  if (hrefEnd < 0 || href === "" || !isSafeHref(href)) {
    return undefined;
  }
  const children = unlink(parse(atoms.slice(start + 1, labelEnd)));
  return { end: hrefEnd + 1, node: { children, href, type: "link" } };
};

const trimUrl = (url: string): string => {
  if (URL_TRAILING_PUNCTUATION.test(url)) {
    return trimUrl(url.slice(0, -1));
  }
  const hasUnmatchedParen =
    url.endsWith(")") && url.split(")").length > url.split("(").length;
  return hasUnmatchedParen ? trimUrl(url.slice(0, -1)) : url;
};

/** A bare `https://` URL in text. */
const bareUrlAt = (
  atoms: readonly Atom[],
  start: number
): Parsed<LinkInline> | undefined => {
  if (isAlphanumericAt(atoms, start - 1)) {
    return undefined;
  }
  let url = "";
  for (let index = start; !isSpaceAt(atoms, index); index += 1) {
    const char = charAt(atoms, index);
    if (char === undefined || char === "<" || char === ">") {
      break;
    }
    url += char;
  }
  url = trimUrl(url);
  if (!BARE_URL.test(url)) {
    return undefined;
  }
  return {
    end: start + [...url].length,
    node: { children: [{ text: url, type: "text" }], href: url, type: "link" },
  };
};

const commandInline = (segments: readonly Segment[]): InlineCode => {
  const children: CodeContent[] = [];
  for (const segment of segments) {
    append(children, toCodeContent(segment));
  }
  const id = segments[0]?.id;
  return { children, command: true, type: "inlineCode", ...(id ? { id } : {}) };
};

/** The construct that starts at `index`, if any. */
const constructAt = (
  atoms: readonly Atom[],
  index: number,
  parse: ParseInline
): Parsed<Inline> | undefined => {
  switch (charAt(atoms, index)) {
    case "`": {
      return codeSpanAt(atoms, index);
    }
    case "*": {
      return emphasisAt(atoms, index, "*", parse);
    }
    case "_": {
      return emphasisAt(atoms, index, "_", parse);
    }
    case "[": {
      return linkAt(atoms, index, parse);
    }
    case "h": {
      return bareUrlAt(atoms, index);
    }
    default: {
      return undefined;
    }
  }
};

const parseInline: ParseInline = (atoms) => {
  const inlines: Inline[] = [];
  let index = 0;
  while (index < atoms.length) {
    const atom = atoms[index] as Atom;
    const next = charAt(atoms, index + 1);
    const construct = constructAt(atoms, index, parseInline);
    if (atom.kind === "param") {
      append(inlines, toCodeContent(atom.segment));
      index += 1;
    } else if (atom.kind === "command") {
      append(inlines, commandInline(atom.segments));
      index += 1;
    } else if (atom.char === "\\" && ASCII_PUNCTUATION.test(next ?? "")) {
      append(inlines, { text: next ?? "", type: "text" });
      index += 2;
    } else if (construct) {
      append(inlines, construct.node);
      index = construct.end;
    } else {
      // An unmatched run of delimiters stays literal as a whole.
      const run = DELIMITERS.has(atom.char)
        ? runLength(atoms, index, atom.char)
        : 1;
      append(inlines, { text: atom.char.repeat(run), type: "text" });
      index += run;
    }
  }
  return inlines;
};

const inlineContent = (lines: readonly Line[]): Inline[] => {
  const segments: Segment[] = [];
  for (const [index, line] of lines.entries()) {
    if (index > 0) {
      segments.push({ text: "\n", type: "text" });
    }
    segments.push(...trimLine(line));
  }
  return parseInline(toAtoms(segments));
};

// Block parsing works line by line, like Markdown.

type ParseBlocks = (lines: readonly Line[]) => Block[];

interface Fence {
  char: string;
  indent: number;
  info: string;
  length: number;
}

const openingFence = (line: Line): Fence | undefined => {
  const groups = FENCE_OPEN.exec(lineText(line))?.groups;
  const fence = groups?.fence ?? "";
  const info = groups?.info ?? "";
  if (!groups || (fence.startsWith("`") && info.includes("`"))) {
    return undefined;
  }
  return {
    char: fence[0] ?? "`",
    indent: groups.indent?.length ?? 0,
    info: info.trim(),
    length: fence.length,
  };
};

const closesFence = (line: Line, open: Fence) => {
  const fence = FENCE_CLOSE.exec(lineText(line))?.groups?.fence ?? "";
  return fence[0] === open.char && fence.length >= open.length;
};

const startsBlock = (line: Line) => {
  const text = lineText(line);
  return (
    openingFence(line) !== undefined ||
    ATX_HEADING.test(text) ||
    THEMATIC_BREAK.test(text) ||
    BLOCKQUOTE.test(text) ||
    LIST_MARKER.test(text) ||
    isCommandLine(line)
  );
};

/** Lists only interrupt a paragraph with a bullet or a 1, and not when empty. */
const interruptsParagraph = (line: Line) => {
  const groups = LIST_MARKER.exec(lineText(line))?.groups;
  if (!groups || THEMATIC_BREAK.test(lineText(line))) {
    return startsBlock(line);
  }
  const isEmpty = trimLine(line).length === 0 || groups.space === "";
  return !isEmpty && (groups.number === undefined || groups.number === "1");
};

const readFence = (
  lines: readonly Line[],
  start: number,
  open: Fence
): Parsed<CodeBlock> => {
  let end = start + 1;
  while (end < lines.length && !closesFence(lines[end] ?? [], open)) {
    end += 1;
  }
  const body = lines
    .slice(start + 1, end)
    .map((line) => dropStart(line, Math.min(indentOf(line), open.indent)));
  const info = INFO.exec(open.info)?.groups;
  const opening = lines[start] ?? [];
  const id = opening.find((segment) => segment.type === "fence")?.id;
  return {
    end: Math.min(end + 1, lines.length),
    node: {
      children: codeContent(body),
      type: "code",
      ...(id ? { id } : {}),
      ...(info?.lang ? { lang: info.lang } : {}),
      ...(info?.meta ? { meta: info.meta } : {}),
    },
  };
};

const readCommand = (
  lines: readonly Line[],
  start: number
): Parsed<CommandBlock> => {
  const id = commandId(lines[start] ?? []);
  let end = start + 1;
  while (
    end < lines.length &&
    isCommandLine(lines[end] ?? []) &&
    commandId(lines[end] ?? []) === id
  ) {
    end += 1;
  }
  const children = codeContent(lines.slice(start, end).map(trimLine));
  return { end, node: { children, type: "command", ...(id ? { id } : {}) } };
};

const readHeading = (line: Line, marks: string): HeadingBlock => {
  const markLength = ATX_HEADING.exec(lineText(line))?.[0].length ?? 0;
  let content = trimLine(dropStart(line, markLength));
  const closing = CLOSING_HASHES.exec(lineText(content));
  if (closing && content.at(-1)?.type === "text") {
    content = takeStart(content, closing.index);
  }
  return {
    children: inlineContent([content]),
    level: marks.length as HeadingBlock["level"],
    type: "heading",
  };
};

const readBlockquote = (
  lines: readonly Line[],
  start: number,
  parse: ParseBlocks
): Parsed<BlockquoteBlock> => {
  const body: Line[] = [];
  let end = start;
  while (end < lines.length) {
    const line = lines[end] ?? [];
    const prefix = BLOCKQUOTE.exec(lineText(line))?.[0];
    if (prefix === undefined) {
      break;
    }
    body.push(dropStart(line, prefix.length));
    end += 1;
  }
  return { end, node: { children: parse(body), type: "blockquote" } };
};

interface Marker {
  /** The column where the item's content starts. */
  contentIndent: number;
  /** The bullet, or `o` and the delimiter for ordered items. */
  kind: string;
  number?: number;
}

const listMarker = (line: Line): Marker | undefined => {
  const text = lineText(line);
  const groups = LIST_MARKER.exec(text)?.groups;
  if (!groups || THEMATIC_BREAK.test(text)) {
    return undefined;
  }
  const markerEnd = (groups.indent?.length ?? 0) + (groups.marker?.length ?? 1);
  const spaces = groups.space?.length ?? 0;
  const isTight =
    spaces > 0 &&
    spaces <= MAX_MARKER_SPACES &&
    !isBlank(dropStart(line, markerEnd));
  const contentIndent = isTight ? markerEnd + spaces : markerEnd + 1;
  if (groups.number === undefined) {
    return { contentIndent, kind: groups.marker ?? "-" };
  }
  return {
    contentIndent,
    kind: `o${groups.delimiter ?? "."}`,
    number: Number(groups.number),
  };
};

/** The lines of one list item, without its marker and indentation. */
const readItem = (
  lines: readonly Line[],
  start: number,
  marker: Marker
): Parsed<Line[]> => {
  const first = dropStart(lines[start] ?? [], marker.contentIndent);
  const body: Line[] = [first];
  let end = start + 1;
  let previousBlank = isBlank(first);
  while (end < lines.length) {
    const line = lines[end] ?? [];
    const isLazy = !previousBlank && !startsBlock(line);
    if (isBlank(line)) {
      body.push([]);
    } else if (indentOf(line) >= marker.contentIndent) {
      body.push(dropStart(line, marker.contentIndent));
    } else if (isLazy) {
      body.push(line);
    } else {
      break;
    }
    previousBlank = isBlank(line);
    end += 1;
  }
  return { end, node: body };
};

const readList = (
  lines: readonly Line[],
  start: number,
  first: Marker,
  parse: ParseBlocks
): Parsed<ListBlock> => {
  const items: ListItem[] = [];
  let end = start;
  while (end < lines.length) {
    const marker = listMarker(lines[end] ?? []);
    if (marker?.kind !== first.kind) {
      break;
    }
    const item = readItem(lines, end, marker);
    items.push({ children: parse(item.node) });
    ({ end } = item);
  }
  return {
    end,
    node: {
      items,
      ordered: first.number !== undefined,
      type: "list",
      ...(first.number === undefined ? {} : { start: first.number }),
    },
  };
};

const readParagraph = (
  lines: readonly Line[],
  start: number
): Parsed<HeadingBlock | ParagraphBlock> => {
  const body: Line[] = [lines[start] ?? []];
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end] ?? [];
    const underline = SETEXT_UNDERLINE.exec(lineText(line))?.groups?.mark;
    if (underline) {
      const level = underline.startsWith("=") ? 1 : 2;
      return {
        end: end + 1,
        node: { children: inlineContent(body), level, type: "heading" },
      };
    }
    if (isBlank(line) || interruptsParagraph(line)) {
      break;
    }
    body.push(line);
    end += 1;
  }
  return { end, node: { children: inlineContent(body), type: "paragraph" } };
};

const readBlock = (
  lines: readonly Line[],
  start: number,
  parse: ParseBlocks
): Parsed<Block> => {
  const line = lines[start] ?? [];
  const text = lineText(line);
  const fence = openingFence(line);
  const marks = ATX_HEADING.exec(text)?.groups?.marks;
  const marker = listMarker(line);
  if (fence) {
    return readFence(lines, start, fence);
  }
  if (isCommandLine(line)) {
    return readCommand(lines, start);
  }
  if (marks) {
    return { end: start + 1, node: readHeading(line, marks) };
  }
  if (THEMATIC_BREAK.test(text)) {
    return { end: start + 1, node: { type: "thematicBreak" } };
  }
  if (BLOCKQUOTE.test(text)) {
    return readBlockquote(lines, start, parse);
  }
  if (marker) {
    return readList(lines, start, marker, parse);
  }
  return readParagraph(lines, start);
};

const parseBlocks: ParseBlocks = (lines) => {
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    if (isBlank(lines[index] ?? [])) {
      index += 1;
      continue;
    }
    const block = readBlock(lines, index, parseBlocks);
    blocks.push(block.node);
    index = block.end;
  }
  return blocks;
};

/** Frontmatter kept in a Markdown prompt, shown as a YAML block. */
const readFrontmatter = (
  lines: readonly Line[]
): Parsed<CodeBlock> | undefined => {
  if (!FRONTMATTER_OPEN.test(lineText(lines[0] ?? []))) {
    return undefined;
  }
  const close = lines.findIndex(
    (line, index) => index > 0 && FRONTMATTER_CLOSE.test(lineText(line))
  );
  if (close === -1) {
    return undefined;
  }
  const children = codeContent(lines.slice(1, close));
  return { end: close + 1, node: { children, lang: "yaml", type: "code" } };
};

/**
 * Parses a rendered prompt's Markdown into blocks for a formatted view.
 * Params keep their names and embedded commands stay marked, so a UI can
 * highlight them. Markdown it doesn't know, such as tables, stays paragraph
 * text. What users copy is still `toText(rendered)`.
 */
export const toBlocks = (rendered: Rendered): Block[] => {
  const lines = toLines(toSegments(rendered));
  const frontmatter = readFrontmatter(lines);
  if (!frontmatter) {
    return parseBlocks(lines);
  }
  return [frontmatter.node, ...parseBlocks(lines.slice(frontmatter.end))];
};
