import { COLLECTION, DEFINITION } from "./brand";
import { parseMarkdown } from "./markdown";
import { fragment } from "./nodes";
import type { Node } from "./nodes";
import type { ParamsShape, TemplateValues } from "./params";
import type {
  Collection,
  CommandDefinition,
  DefinitionMeta,
  Definition,
  Deps,
  Dimensions,
  PromptDefinition,
  SnippetDefinition,
  SnippetVariant,
  Template,
  TemplateResult,
  Verify,
} from "./types";

const ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;

const assertId = (id: string) => {
  if (!ID_PATTERN.test(id)) {
    throw new Error(
      `Invalid definition id "${id}". Use lowercase letters, digits, and ".", "-", or "_" between them.`
    );
  }
};

type TemplateFn<S extends ParamsShape> = (
  t: Template,
  values: TemplateValues<S>
) => TemplateResult;

/** Never run this command or snippet in tests, for the given reason. */
export const skip = (reason: string): Verify => ({ skip: reason });

interface CommandInput<S extends ParamsShape> extends DefinitionMeta {
  params?: S;
  template: TemplateFn<S>;
  verify?: Verify;
}

/** A shell command, such as `neon init --project-id <id>`. */
export const defineCommand = <S extends ParamsShape = Record<never, never>>(
  input: CommandInput<S>
): CommandDefinition<S> => {
  assertId(input.id);
  return Object.freeze({
    ...input,
    [DEFINITION]: true as const,
    kind: "command" as const,
    params: input.params ?? ({} as S),
    verify: input.verify ?? "syntax",
  });
};

/** A deep copy of a rendered tree's nodes. */
const copyNodes = (nodes: readonly Node[]): Node[] =>
  nodes.map((node) =>
    "children" in node
      ? { ...node, children: copyNodes(node.children) }
      : { ...node }
  );

type PromptInput<S extends ParamsShape> = DefinitionMeta &
  (
    | { markdown?: never; params?: S; template: TemplateFn<S> }
    | {
        /** The prompt as Markdown, rendered exactly as written. */
        markdown: string;
        params?: never;
        template?: never;
      }
  );

/**
 * A prompt that users paste into a coding agent. Give it a `template`, or
 * its `markdown` text.
 */
export const definePrompt = <S extends ParamsShape = Record<never, never>>(
  input: PromptInput<S>
): PromptDefinition<S> => {
  assertId(input.id);
  const { markdown, template } = input;
  // Parsed once. Each render gets its own copy, so callers can't share nodes.
  const nodes = markdown === undefined ? undefined : parseMarkdown(markdown);
  return Object.freeze({
    ...input,
    [DEFINITION]: true as const,
    kind: "prompt" as const,
    params: input.params ?? ({} as S),
    template:
      nodes === undefined
        ? (template as TemplateFn<S>)
        : () => fragment(copyNodes(nodes)),
  });
};

type Body<S extends ParamsShape> =
  | { code: string; template?: never }
  | { code?: never; template: TemplateFn<S> };

type VariantInput<S extends ParamsShape, D extends Dimensions> = Body<S> & {
  deps?: Deps;
  lang?: string;
  verify?: Verify;
  /** The dimension options this variant covers. */
  when: { readonly [K in keyof D]?: D[K][number]["value"] };
};

type SingleSnippetInput<S extends ParamsShape> = Body<S> &
  DefinitionMeta & {
    deps?: Deps;
    dimensions?: never;
    lang?: string;
    params?: S;
    variants?: never;
    verify?: Verify;
  };

interface VariantSnippetInput<
  S extends ParamsShape,
  D extends Dimensions,
> extends DefinitionMeta {
  dimensions: D;
  params?: S;
  variants: readonly VariantInput<S, D>[];
  verify?: Verify;
}

/** Builds the canonical variant key, with dimensions in declaration order. */
export const variantKey = (
  dimensions: Dimensions,
  when: Readonly<Record<string, string | undefined>>
): string =>
  Object.keys(dimensions)
    .filter((dimension) => when[dimension] !== undefined)
    .map((dimension) => `${dimension}=${when[dimension]}`)
    .join(";");

const toTemplate = <S extends ParamsShape>(body: Body<S>): TemplateFn<S> => {
  if (body.template) {
    return body.template;
  }
  const { code } = body;
  return () => code ?? "";
};

/** Puts `when` keys in dimension declaration order for stable labels. */
const normalizeWhen = (
  dimensions: Dimensions,
  when: Readonly<Record<string, string>>
): Record<string, string> => {
  const ordered: Record<string, string> = {};
  for (const key of Object.keys(dimensions)) {
    const value = when[key];
    if (value !== undefined) {
      ordered[key] = value;
    }
  }
  for (const [key, value] of Object.entries(when)) {
    if (!(key in ordered)) {
      ordered[key] = value;
    }
  }
  return ordered;
};

const toVariant = <S extends ParamsShape>(
  dimensions: Dimensions,
  input: VariantInput<S, Dimensions> | SingleSnippetInput<S>,
  when: Readonly<Record<string, string>>
): SnippetVariant<S> => {
  const orderedWhen = normalizeWhen(dimensions, when);
  const variant: SnippetVariant<S> = {
    key: variantKey(dimensions, orderedWhen),
    template: toTemplate(input),
    when: orderedWhen,
    ...(input.deps ? { deps: input.deps } : {}),
    ...(input.lang ? { lang: input.lang } : {}),
    ...(input.verify ? { verify: input.verify } : {}),
  };
  return Object.freeze(variant);
};

const assertVariants = (
  id: string,
  dimensions: Dimensions,
  variants: readonly SnippetVariant[]
) => {
  const seen = new Set<string>();
  for (const variant of variants) {
    for (const [dimension, option] of Object.entries(variant.when)) {
      const options = dimensions[dimension] ?? [];
      if (!options.some((candidate) => candidate.value === option)) {
        throw new Error(
          `Snippet "${id}" has a variant with unknown ${dimension} "${option}".`
        );
      }
    }
    if (seen.has(variant.key)) {
      throw new Error(`Snippet "${id}" has two variants for "${variant.key}".`);
    }
    seen.add(variant.key);
  }
};

/**
 * A code snippet. Give it `lang` and `template` (or `code`), or declare
 * `dimensions` and one entry in `variants` per combination you show.
 */
export function defineSnippet<
  S extends ParamsShape = Record<never, never>,
  const D extends Dimensions = Dimensions,
>(input: VariantSnippetInput<S, D>): SnippetDefinition<S>;
export function defineSnippet<S extends ParamsShape = Record<never, never>>(
  input: SingleSnippetInput<S>
): SnippetDefinition<S>;
// oxlint-disable-next-line func-style -- overloads need a declaration
export function defineSnippet<S extends ParamsShape>(
  input: SingleSnippetInput<S> | VariantSnippetInput<S, Dimensions>
): SnippetDefinition<S> {
  assertId(input.id);
  const dimensions = input.dimensions ?? {};
  const variants = input.variants
    ? input.variants.map((variant) =>
        toVariant(
          dimensions,
          variant,
          variant.when as Readonly<Record<string, string>>
        )
      )
    : [toVariant<S>(dimensions, input as SingleSnippetInput<S>, {})];

  if (variants.length === 0) {
    throw new Error(`Snippet "${input.id}" needs at least one variant.`);
  }
  assertVariants(input.id, dimensions, variants);

  const {
    code: _code,
    deps: _deps,
    lang: _lang,
    template: _template,
    ...meta
  } = input as SingleSnippetInput<S>;

  return Object.freeze({
    ...meta,
    [DEFINITION]: true as const,
    dimensions,
    kind: "snippet" as const,
    params: input.params ?? ({} as S),
    variants,
    verify: input.verify ?? "syntax",
  });
}

interface CollectionInput<T, K extends string, D extends Definition> {
  /** Builds the definition for one item. It must use the `id` it's given. */
  build: (item: T, context: { id: string; key: K }) => D;
  /** Ids are `<idPrefix>.<key>`. */
  idPrefix: string;
  items: Iterable<T>;
  /** A stable key from the item's data, never its index. */
  key: (item: T) => K;
}

/**
 * Definitions generated from data, such as one snippet per model. Ids come
 * from each item's key, so reordering or adding items never changes them.
 */
export const defineCollection = <T, K extends string, D extends Definition>(
  input: CollectionInput<T, K, D>
): Collection<K, D> => {
  const definitions = new Map<K, D>();
  for (const item of input.items) {
    const key = input.key(item);
    const id = `${input.idPrefix}.${key}`;
    if (definitions.has(key)) {
      throw new Error(
        `Collection "${input.idPrefix}" has duplicate key "${key}".`
      );
    }
    const definition = input.build(item, { id, key });
    if (definition.id !== id) {
      throw new Error(
        `Collection "${input.idPrefix}" built "${definition.id}" for key "${key}". Use the id passed to build: "${id}".`
      );
    }
    definitions.set(key, definition);
  }

  return Object.freeze({
    [COLLECTION]: true as const,
    definitions,
    get: (key: K) => {
      const definition = definitions.get(key);
      if (!definition) {
        throw new Error(`Collection "${input.idPrefix}" has no key "${key}".`);
      }
      return definition;
    },
    idPrefix: input.idPrefix,
  });
};

export const isDefinition = (value: unknown): value is Definition =>
  typeof value === "object" && value !== null && DEFINITION in value;

export const isCollection = (value: unknown): value is Collection =>
  typeof value === "object" && value !== null && COLLECTION in value;
