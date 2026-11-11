const LEADING_WHITESPACE = /^[ \t]*/u;
const BLANK_FIRST_LINE = /^[ \t]*\n/u;
const BLANK_LAST_LINE = /\n[ \t]*$/u;

/** Escapes (with `\u{...}` captured) and real newlines in a raw string. */
const SOURCE_TOKEN =
  /\\(?:u\{(?<codePoint>\p{AHex}+)\}|u\p{AHex}{4}|x\p{AHex}{2}|[^])|\n/gu;

type TemplateParts = readonly string[] & {
  readonly raw?: readonly (string | undefined)[];
};

/**
 * Strips up to `strip` source whitespace characters after each real line
 * break in `raw`, and applies that to `cooked`. Whitespace that comes from
 * an escape, like `\x20`, isn't source indentation, so it stays. `literal`
 * says `raw` has no escapes to decode.
 */
const stripSourceIndent = (
  cooked: string,
  raw: string,
  strip: number,
  literal: boolean
): string => {
  let result = "";
  let copied = 0;
  // Cooked offset minus raw offset, as escapes shorten or lengthen the text.
  let shift = 0;
  for (const match of raw.matchAll(SOURCE_TOKEN)) {
    const { 0: token, groups } = match;
    const codePoint = Number.parseInt(groups?.codePoint ?? "0", 16);
    let length = codePoint > 0xff_ff ? 2 : 1;
    if (token === "\\\n") {
      length = 0;
    }
    if (!literal) {
      shift += length - token.length;
    }
    if (!token.endsWith("\n")) {
      continue;
    }
    const end = match.index + token.length;
    const indent = LEADING_WHITESPACE.exec(raw.slice(end))?.[0].length ?? 0;
    result += cooked.slice(copied, end + shift);
    copied = end + shift + Math.min(strip, indent);
  }
  return result + cooked.slice(copied);
};

/**
 * Dedents the static strings of a tagged template. The common indentation is
 * computed from `strings.raw`, so cooked escapes like `\n` don't look like
 * line breaks. A blank first line and a blank last line are dropped, so
 * templates can open and close on their own lines.
 */
export const dedentStrings = (strings: TemplateParts): string[] => {
  const raw = strings.raw ?? strings;
  let indent = Number.POSITIVE_INFINITY;

  for (const [index, string] of raw.entries()) {
    if (string === undefined) {
      continue;
    }
    const lines = string.split("\n");
    for (const [lineIndex, line] of lines.entries()) {
      // The first line of each string continues the previous one.
      if (lineIndex === 0) {
        continue;
      }
      const isLastLine = lineIndex === lines.length - 1;
      const followedByValue = isLastLine && index < strings.length - 1;
      if (line.trim() === "" && !followedByValue) {
        continue;
      }
      indent = Math.min(indent, LEADING_WHITESPACE.exec(line)?.[0].length ?? 0);
    }
  }

  const strip = Number.isFinite(indent) ? indent : 0;
  const result = [...strings].map((cooked, index) => {
    // Invalid escapes make the cooked value undefined; use the raw source.
    const string = cooked ?? raw[index];
    if (string === undefined) {
      throw new Error(
        "Invalid escape sequence in template. Escape each backslash as \\\\."
      );
    }
    const literal = cooked === undefined || !strings.raw;
    return stripSourceIndent(string, raw[index] ?? string, strip, literal);
  });

  const [first] = result;
  if (first !== undefined) {
    result[0] = first.replace(BLANK_FIRST_LINE, "");
  }
  const lastIndex = result.length - 1;
  const last = result[lastIndex];
  if (last !== undefined) {
    result[lastIndex] = last.replace(BLANK_LAST_LINE, "");
  }

  return result;
};
