// Definitions declare `template` with method syntax on purpose: method
// params are bivariant, which keeps a definition with specific params
// assignable to `Definition`.
/* oxlint-disable typescript/method-signature-style */
import type { COLLECTION, DEFINITION } from "./brand";
import type { Fragment } from "./nodes";
import type { InputValues, ParamsShape, TemplateValues } from "./params";

/** Anything a `t` template accepts between `${` and `}`. */
export type Interpolation =
  | Fragment
  | boolean
  | null
  | number
  | string
  | undefined
  | readonly Interpolation[];

type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K;
}[keyof T];

/** `values` is required only when the params have required keys. */
export type ValuesArg<S extends ParamsShape> =
  RequiredKeys<InputValues<S>> extends never
    ? [values?: InputValues<S>]
    : [values: InputValues<S>];

/** Selects a snippet variant by key (`framework=python`) or by dimensions. */
export type VariantSelection = Readonly<Record<string, string>> | string;

/**
 * The template tag passed to every `template` function. Params interpolated
 * directly become param nodes, so UIs can highlight them.
 */
export interface Template {
  (strings: TemplateStringsArray, ...values: Interpolation[]): Fragment;
  /** Embeds a command: a literal, a fragment, or a command definition. */
  cmd: {
    (command: Fragment | string): Fragment;
    <S extends ParamsShape>(
      definition: CommandDefinition<S>,
      ...values: ValuesArg<S>
    ): Fragment;
  };
  /** Embeds a code block: `t.code("ts", code)`, or a snippet definition. */
  code: {
    (lang: string, content: Fragment | string): Fragment;
    <S extends ParamsShape>(
      snippet: SnippetDefinition<S>,
      values?: InputValues<S>,
      options?: { variant?: VariantSelection }
    ): Fragment;
  };
  /** Embeds another definition, such as a shared prompt section. */
  include: <S extends ParamsShape>(
    definition: Definition<S>,
    ...values: ValuesArg<S>
  ) => Fragment;
}

export type TemplateResult = Fragment | string;

/**
 * How the CLI verifies a command or snippet:
 * - `syntax`: parse only (default)
 * - `typecheck`: install dependencies and typecheck
 * - `run`: execute it with fixture values
 * - `{ skip }`: never run it, with a reason, such as an interactive login
 */
export type Verify = "run" | "syntax" | "typecheck" | { readonly skip: string };

/** Packages a snippet needs, installed into the sandbox by the test runner. */
export interface Deps {
  readonly npm?: readonly string[];
  readonly pip?: readonly string[];
}

/** Dimension name → option value → label, in display order. */
export type Dimensions = Readonly<
  Record<string, Readonly<Record<string, string>>>
>;

export interface DefinitionMeta {
  /** Previous ids, kept so history and results follow a rename. */
  readonly aliases?: readonly string[];
  readonly description?: string;
  /** A stable, lowercase, dotted id such as `console.connect.postgres`. */
  readonly id: string;
  readonly owners?: readonly string[];
  /** Where the product shows this, such as `console/create-project`. */
  readonly placements?: readonly string[];
  readonly tags?: readonly string[];
  readonly title?: string;
}

interface Branded {
  readonly [DEFINITION]: true;
}

export interface CommandDefinition<S extends ParamsShape = ParamsShape>
  extends DefinitionMeta, Branded {
  readonly kind: "command";
  readonly params: S;
  readonly verify: Verify;
  template(t: Template, values: TemplateValues<S>): TemplateResult;
}

export interface SnippetVariant<S extends ParamsShape = ParamsShape> {
  readonly deps?: Deps;
  /** `framework=python;setup=env`, or `""` for a snippet without variants. */
  readonly key: string;
  readonly lang?: string;
  readonly verify?: Verify;
  readonly when: Readonly<Record<string, string>>;
  template(t: Template, values: TemplateValues<S>): TemplateResult;
}

export interface SnippetDefinition<S extends ParamsShape = ParamsShape>
  extends DefinitionMeta, Branded {
  readonly dimensions: Dimensions;
  readonly kind: "snippet";
  readonly params: S;
  readonly variants: readonly SnippetVariant<S>[];
  readonly verify: Verify;
}

export interface PromptDefinition<S extends ParamsShape = ParamsShape>
  extends DefinitionMeta, Branded {
  readonly kind: "prompt";
  readonly params: S;
  template(t: Template, values: TemplateValues<S>): TemplateResult;
}

export type Definition<S extends ParamsShape = ParamsShape> =
  | CommandDefinition<S>
  | PromptDefinition<S>
  | SnippetDefinition<S>;

export interface Collection<
  K extends string = string,
  D extends Definition = Definition,
> {
  readonly [COLLECTION]: true;
  readonly definitions: ReadonlyMap<K, D>;
  /** Returns the definition for a key, or throws if there isn't one. */
  get: (key: K) => D;
  readonly idPrefix: string;
}
