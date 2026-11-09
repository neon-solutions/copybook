const LEADING_WHITESPACE = /^[ \t]*/u;
const BLANK_FIRST_LINE = /^[ \t]*\n/u;
const BLANK_LAST_LINE = /\n[ \t]*$/u;

type TemplateParts = readonly string[] & {
  readonly raw?: readonly (string | undefined)[];
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
    return string
      .split("\n")
      .map((line, lineIndex) => {
        if (lineIndex === 0) {
          return line;
        }
        const leading = LEADING_WHITESPACE.exec(line)?.[0].length ?? 0;
        return line.slice(Math.min(strip, leading));
      })
      .join("\n");
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
