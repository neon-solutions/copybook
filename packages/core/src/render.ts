import { isDefinition } from "./define";
import type { Node, ParamNode, Rendered } from "./nodes";
import type { AnyParam, ParamsShape } from "./params";
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
): { info?: ParamInfo; value: unknown } => {
  const { state } = param;
  const secret = state.kind === "secret";
  const isPlaceholder = secret && given === state.placeholder;

  if (given !== undefined && !isPlaceholder) {
    return { info: secret ? { name, secret: true } : { name }, value: given };
  }
  if (mode === "example" && state.example !== undefined) {
    return { info: { name }, value: state.example };
  }
  if (state.default !== undefined) {
    return { info: { name }, value: state.default };
  }
  if (secret) {
    return {
      info: { name, placeholder: true, secret: true },
      value: state.placeholder,
    };
  }
  if (state.optional) {
    return { value: undefined };
  }
  throw missing(definition, name, mode);
};

/** Applies defaults, examples, and secret placeholders to the given values. */
const resolveValues = (
  definition: Definition,
  input: Readonly<Record<string, unknown>> | undefined,
  mode: Mode
) => {
  const values: Record<string, unknown> = {};
  const params = new Map<string, ParamInfo>();

  for (const [name, param] of Object.entries(
    definition.params as ParamsShape
  )) {
    const resolved = resolveParam(definition, name, param, input?.[name], mode);
    values[name] = resolved.value;
    const isHighlightable =
      typeof resolved.value === "string" || typeof resolved.value === "number";
    const key = String(resolved.value);
    // The first param with a given value wins when two share it.
    if (resolved.info && isHighlightable && key !== "" && !params.has(key)) {
      params.set(key, resolved.info);
    }
  }

  return { params, values };
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
  mode: Mode
): Rendered => {
  if (!isDefinition(definition)) {
    throw new TypeError("Expected a definition from define*().");
  }
  const { params, values } = resolveValues(definition, input, mode);
  const context: TemplateContext = {
    embed: (embedded, embeddedValues, variant) =>
      renderWith(
        embedded as Definition,
        embeddedValues as Record<string, unknown> | undefined,
        variant === undefined
          ? undefined
          : { variant: variant as VariantSelection },
        mode
      ),
    params,
  };
  const t = createTemplate(context);

  if (definition.kind === "snippet") {
    const variant = selectVariant(definition, options?.variant);
    const rendered: Rendered = {
      id: definition.id,
      kind: "snippet",
      nodes: toNodeList(variant.template(t, values as never)),
    };
    if (variant.lang !== undefined) {
      rendered.lang = variant.lang;
    }
    if (variant.key !== "") {
      rendered.variant = variant.key;
    }
    return rendered;
  }

  return {
    id: definition.id,
    kind: definition.kind,
    nodes: toNodeList(definition.template(t, values as never)),
  };
};

/** Renders a definition with real values, for example in your product's UI. */
export const render = <S extends ParamsShape>(
  definition: Definition<S>,
  ...[values, options]: [...ValuesArg<S>, options?: RenderOptions]
): Rendered =>
  renderWith(
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
): Rendered => renderWith(definition, options?.values, options, "example");

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
          snippet.dimensions[dimension]?.[option] ?? option
      )
      .join(" · ");
    const info: VariantInfo = { key: variant.key, label, when: variant.when };
    if (variant.lang !== undefined) {
      info.lang = variant.lang;
    }
    return info;
  });
