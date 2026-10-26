// No spaces, and no "#" up front, so values never read as comments or keys.
const PLAIN_SCALAR = /^[\w./@+-][\w./@#+:-]*$/u;
const AMBIGUOUS = /^(?:true|false|null|yes|no|on|off|~|[-+]?[\d.]+)$/iu;

const scalar = (value: unknown): string => {
  if (
    typeof value === "string" &&
    PLAIN_SCALAR.test(value) &&
    !AMBIGUOUS.test(value)
  ) {
    return value;
  }
  // JSON scalars are valid YAML.
  return JSON.stringify(value) ?? "null";
};

type Value = Readonly<Record<string, unknown>> | readonly unknown[] | unknown;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const field = (key: string, value: Value): string[] => {
  if (Array.isArray(value)) {
    return value.length === 0
      ? [`${key}: []`]
      : [`${key}:`, ...value.map((item) => `  - ${scalar(item)}`)];
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    return entries.length === 0
      ? [`${key}: {}`]
      : [
          `${key}:`,
          ...entries.map(
            ([name, item]) => `  ${scalar(name)}: ${scalar(item)}`
          ),
        ];
  }
  return [`${key}: ${scalar(value)}`];
};

/**
 * Serializes flat YAML frontmatter: scalars, lists, and one-level maps.
 * Fields are entries so their order is explicit.
 */
export const frontmatter = (
  fields: readonly (readonly [string, Value])[]
): string => {
  const lines = fields
    .filter(([, value]) => value !== undefined)
    .flatMap(([key, value]) => field(key, value));
  return `---\n${lines.join("\n")}\n---\n`;
};
