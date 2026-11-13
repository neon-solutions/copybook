const ESM_START = /^(?:import|export)\b/u;
const FENCE = /^ {0,3}(?<fence>`{3,}|~{3,})/u;
const FRONTMATTER = "---";

/** The line after frontmatter, or 0 when there isn't any. */
const bodyStart = (lines: readonly string[]) => {
  if (lines[0]?.trim() !== FRONTMATTER) {
    return 0;
  }
  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === FRONTMATTER
  );
  return end === -1 ? 0 : end + 1;
};

/**
 * The ESM in an MDX file: blocks that start with `import` or `export` at
 * the start of a line, up to the next blank line. Code fences and
 * frontmatter don't count, so an example import in a code block isn't one.
 */
export const mdxEsm = (source: string): string => {
  const lines = source.split(/\r?\n/u);
  const esm: string[] = [];
  let fence: string | undefined;
  let inEsm = false;
  let blockStart = true;
  for (const line of lines.slice(bodyStart(lines))) {
    const isBlank = line.trim() === "";
    if (fence) {
      // A closing fence ends its block, so the next line starts one.
      const closes = line.trimStart().startsWith(fence);
      fence = closes ? undefined : fence;
      blockStart = closes;
      continue;
    }
    if (!inEsm) {
      fence = FENCE.exec(line)?.groups?.fence;
      inEsm = fence === undefined && blockStart && ESM_START.test(line);
    } else if (isBlank) {
      inEsm = false;
    }
    if (inEsm) {
      esm.push(line);
    }
    blockStart = isBlank;
  }
  return esm.join("\n");
};
