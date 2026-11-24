import { isDefinition } from "./define";
import type { Node, ParamNode, Rendered } from "./nodes";
import type { AnyParam, ParamsShape } from "./params";
import { markSecrets } from "./secrets";
import { createTemplate, normalize } from "./template";
import type { TemplateContext } from "./template";
import type {
  Definition,
  SnippetDefinition,
  SnippetVariant,
  TemplateResult,
  ValuesArg,
  VariantSelection,
} from "./types";

type Mode = "example" | "input";

export interface RenderOptions {
  variant?: VariantSelection;
}

type ParamInfo = Omit<ParamNode, "type" | "value">;

const missing = (definition: Definition, name: string, mode: Mode) =>
  new Error(
    mode === "example"
      ? `Param "${name}" of "${definition.id}" needs an .example() or .default() to render a preview.`
      : `Missing required param "${name}" for "${definition.id}".`
  );

const resolveParam = (
  definition: Definition,
  name: string,
  param: AnyParam,
  given: unknown,
  mode: Mode
): { info: ParamInfo; value?: unknown } => {
  const { state } = param;
  const secret = state.kind === "secret";
  const isPlaceholder = secret && given === state.placeholder;
  // A secret's real value stays marked, wherever the value came from.
  const info: ParamInfo = secret ? { name, secret: true } : { name };

  if (given !== undefined && !isPlaceholder) {
    return { info, value: given };
  }
  if (mode === "example" && state.example !== undefined) {
    return { info, value: state.example };
  }
  if (state.default !== undefined) {
    return { info, value: state.default };
  }
  if (secret) {
    return {
      info: { name, placeholder: true, secret: true },
      value: state.placeholder,
    };
  }
  if (state.optional) {
    return { info };
  }
  throw missing(definition, name, mode);
};

/**
 * A param that gets a node where the template reads it: a string (even an
 * empty one), a number, or an omitted optional param.
 */
interface Highlight {
  info: ParamInfo;
  value: number | string | undefined;
}

const isHighlightable = (
  value: unknown
): value is number | string | undefined =>
  value === undefined || typeof value === "number" || typeof value === "string";

/** Applies defaults, examples, and secret placeholders to the given values. */
const resolveValues = (
  definition: Definition,
  input: Readonly<Record<string, unknown>> | undefined,
  mode: Mode,
  secrets: Set<string>
) => {
  const values: Record<string, unknown> = {};
  const highlights = new Map<string, Highlight>();

  for (const [name, param] of Object.entries(
    definition.params as ParamsShape
  )) {
    const { info, value } = resolveParam(
      definition,
      name,
      param,
      input?.[name],
      mode
    );
    values[name] = value;
    const isRealSecret = info.secret === true && !info.placeholder;
    if (isRealSecret && typeof value === "string" && value !== "") {
      secrets.add(value);
    }
    if (isHighlightable(value)) {
      highlights.set(name, { info, value });
    }
  }

  return { highlights, values };
};

type Label = TemplateContext["label"];

/** Runs the template once, with the given values and labels. */
type Run = (
  values: Record<string, unknown>,
  context: TemplateContext
) => Node[];

/** Every marker starts with this private-use character. */
const MARKER_START = "\u{E000}";

/**
 * The value that stands in for one param in the labelling run. A string
 * marker changes under `toUpperCase` and `toLowerCase`. A number marker
 * keeps the number for arithmetic and comparisons, and prints as a marker.
 */
const markerFor = (value: Highlight["value"], marker: string): unknown =>
  typeof value === "number"
    ? { toString: () => marker, valueOf: () => value }
    : marker;

/** One interpolated value of the labelling run: a param's marker, or other text. */
type Leaf = { highlight: Highlight } | { text: string | undefined };

/**
 * Runs the template with a marker in place of each param's value, and
 * returns its interpolated values in order. A template that rejects the
 * markers gives none.
 */
const discoverLeaves = (
  run: Run,
  values: Readonly<Record<string, unknown>>,
  highlights: ReadonlyMap<string, Highlight>
): Leaf[] | undefined => {
  const marked: Record<string, unknown> = { ...values };
  const owners = new Map<string, Highlight>();
  for (const [index, [name, highlight]] of [...highlights].entries()) {
    const marker = `${MARKER_START}Cb${index}\u{E001}`;
    marked[name] = markerFor(highlight.value, marker);
    owners.set(marker, highlight);
  }
  const leaves: Leaf[] = [];
  // Records the value and labels nothing: this run's nodes are discarded.
  const label: Label = (text): undefined => {
    const highlight = text === undefined ? undefined : owners.get(text);
    leaves.push(highlight ? { highlight } : { text });
  };
  try {
    // No embed: an embedded definition's labels are its own.
    run(marked, { label });
  } catch {
    return undefined;
  }
  return leaves;
};

const textOf = (value: Highlight["value"]) =>
  value === undefined ? undefined : String(value);

/**
 * Whether the real run's value fits the labelling run's. A marker must hold
 * its param's value, text computed from a marker may be anything, and every
 * other value must be the same in both runs.
 */
const fits = (leaf: Leaf, text: string | undefined) => {
  if ("highlight" in leaf) {
    return textOf(leaf.highlight.value) === text;
  }
  return leaf.text?.includes(MARKER_START) === true || leaf.text === text;
};

/**
 * Labels the real run from the labelling run. The two line up when they
 * interpolate the same values; a template that branches on a value can
 * break that.
 */
const alignedLabels = (leaves: readonly Leaf[]) => {
  let index = 0;
  let aligned = true;
  const label: Label = (text) => {
    const leaf = leaves[index];
    index += 1;
    // A real run that interpolates more values than the labelling run has no leaf.
    const fitted = aligned && leaf && fits(leaf, text) ? leaf : undefined;
    aligned = fitted !== undefined;
    return fitted && "highlight" in fitted ? fitted.highlight.info : undefined;
  };
  return { isAligned: () => aligned && index === leaves.length, label };
};

/**
 * The fallback, for a template whose values decide what it interpolates: a
 * value is a param only when exactly one param has it. Empty values are
 * never labelled, since any interpolation can render nothing.
 */
const labelsByValue = (highlights: ReadonlyMap<string, Highlight>): Label => {
  const byValue = new Map<string, ParamInfo | null>();
  for (const { info, value } of highlights.values()) {
    const text = textOf(value);
    if (text !== undefined && text !== "") {
      // Null marks a value that two params share.
      byValue.set(text, byValue.has(text) ? null : info);
    }
  }
  return (text) =>
    text === undefined ? undefined : (byValue.get(text) ?? undefined);
};

/**
 * Renders the nodes, labelling each param where the template reads it. A
 * string carries no identity, so a second, labelling-only run finds which
 * values come from which param.
 */
const renderNodes = (
  run: Run,
  values: Record<string, unknown>,
  highlights: ReadonlyMap<string, Highlight>,
  embed: TemplateContext["embed"]
): Node[] => {
  // With nothing to label, one run is enough.
  if (highlights.size === 0) {
    return run(values, { embed, label: labelsByValue(highlights) });
  }
  const leaves = discoverLeaves(run, values, highlights);
  if (leaves) {
    const aligned = alignedLabels(leaves);
    const nodes = run(values, { embed, label: aligned.label });
    if (aligned.isAligned()) {
      return nodes;
    }
  }
  return run(values, { embed, label: labelsByValue(highlights) });
};

const matchesSelection = (
  variant: SnippetVariant,
  selection: VariantSelection
) =>
  typeof selection === "string"
    ? variant.key === selection
    : Object.entries(selection).every(
        ([dimension, option]) => variant.when[dimension] === option
      );

/** Picks a snippet variant. Without a selection, the first variant wins. */
export const selectVariant = <S extends ParamsShape>(
  snippet: SnippetDefinition<S>,
  selection?: VariantSelection
): SnippetVariant<S> => {
  const variant =
    selection === undefined
      ? snippet.variants[0]
      : snippet.variants.find((candidate) =>
          matchesSelection(candidate, selection)
        );
  if (!variant) {
    const wanted =
      typeof selection === "string" ? selection : JSON.stringify(selection);
    throw new Error(`Snippet "${snippet.id}" has no variant ${wanted}.`);
  }
  return variant;
};

const toNodeList = (result: TemplateResult): Node[] =>
  typeof result === "string"
    ? normalize([{ type: "text", value: result }])
    : result.nodes;

const renderWith = (
  definition: Definition,
  input: Readonly<Record<string, unknown>> | undefined,
  options: RenderOptions | undefined,
  mode: Mode,
  secrets: Set<string>
): Rendered => {
  if (!isDefinition(definition)) {
    throw new TypeError("Expected a definition from define*().");
  }
  const { highlights, values } = resolveValues(
    definition,
    input,
    mode,
    secrets
  );
  const embed: TemplateContext["embed"] = (embedded, embeddedValues, variant) =>
    renderWith(
      embedded as Definition,
      embeddedValues as Record<string, unknown> | undefined,
      variant === undefined
        ? undefined
        : { variant: variant as VariantSelection },
      mode,
      secrets
    );

  if (definition.kind === "snippet") {
    const variant = selectVariant(definition, options?.variant);
    const run: Run = (runValues, context) =>
      toNodeList(variant.template(createTemplate(context), runValues as never));
    const rendered: Rendered = {
      id: definition.id,
      kind: "snippet",
      nodes: renderNodes(run, values, highlights, embed),
    };
    if (variant.lang !== undefined) {
      rendered.lang = variant.lang;
    }
    if (variant.key !== "") {
      rendered.variant = variant.key;
    }
    return rendered;
  }

  const run: Run = (runValues, context) =>
    toNodeList(
      definition.template(createTemplate(context), runValues as never)
    );
  return {
    id: definition.id,
    kind: definition.kind,
    nodes: renderNodes(run, values, highlights, embed),
  };
};

/**
 * Renders from the top, collecting every real secret the tree's definitions
 * resolve, then marks them once over the whole tree.
 */
const renderTop = (
  definition: Definition,
  input: Readonly<Record<string, unknown>> | undefined,
  options: RenderOptions | undefined,
  mode: Mode
): Rendered => {
  const secrets = new Set<string>();
  const rendered = renderWith(definition, input, options, mode, secrets);
  return { ...rendered, nodes: markSecrets(rendered.nodes, [...secrets]) };
};

/** Renders a definition with real values, for example in your product's UI. */
export const render = <S extends ParamsShape>(
  definition: Definition<S>,
  ...[values, options]: [...ValuesArg<S>, options?: RenderOptions]
): Rendered =>
  renderTop(
    definition as Definition,
    values as Readonly<Record<string, unknown>> | undefined,
    options,
    "input"
  );

/**
 * Renders a definition with its example values, filling the gaps you pass.
 * Previews, snapshots, and Studio use this.
 */
export const renderExample = (
  definition: Definition,
  options?: RenderOptions & { values?: Readonly<Record<string, unknown>> }
): Rendered => renderTop(definition, options?.values, options, "example");

export interface VariantInfo {
  key: string;
  /** Option labels joined with " · ", such as `AI SDK · .env`. */
  label: string;
  lang?: string;
  when: Readonly<Record<string, string>>;
}

/** Lists a snippet's variants with display labels, in declaration order. */
export const listVariants = (snippet: SnippetDefinition): VariantInfo[] =>
  snippet.variants.map((variant) => {
    const label = Object.entries(variant.when)
      .map(
        ([dimension, option]) =>
          snippet.dimensions[dimension]?.find(
            (candidate) => candidate.value === option
          )?.label ?? option
      )
      .join(" · ");
    const info: VariantInfo = { key: variant.key, label, when: variant.when };
    if (variant.lang !== undefined) {
      info.lang = variant.lang;
    }
    return info;
  });
