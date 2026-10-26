import type { InferSchemaOutput, StandardSchemaV1 } from "./standard-schema";

export type ParamKind =
  | "boolean"
  | "enum"
  | "number"
  | "schema"
  | "secret"
  | "string"
  | "url";

/** Whether a param must be passed to `render`. */
type Input = "optional" | "required";
/** Whether a param is always present inside a template. */
type Presence = "maybe" | "present";

interface ParamState<T> {
  readonly default?: T;
  readonly description?: string;
  readonly env?: string;
  readonly example?: T;
  readonly kind: ParamKind;
  readonly optional: boolean;
  readonly placeholder?: string;
  readonly schema?: StandardSchemaV1;
  readonly values?: readonly string[];
}

/**
 * A typed param. Builders are immutable: every method returns a new param.
 * The phantom type parameters carry the value type and whether the param is
 * required at render time and present inside templates.
 */
export class Param<
  T = unknown,
  I extends Input = Input,
  P extends Presence = Presence,
> {
  readonly state: ParamState<T>;
  declare readonly "~types": { input: I; presence: P; value: T };

  constructor(state: ParamState<T>) {
    this.state = state;
  }

  /** Shown in Studio and the manifest. */
  describe(description: string): Param<T, I, P> {
    return new Param({ ...this.state, description });
  }

  /** Used for previews, snapshots, and Studio when no value is given. */
  example(example: T): Param<T, I, P> {
    return new Param({ ...this.state, example });
  }

  /** Used when no value is passed to `render`. */
  default(value: T): Param<T, "optional", "present"> {
    return new Param({ ...this.state, default: value, optional: true });
  }

  optional(): Param<T, "optional", "maybe"> {
    return new Param({ ...this.state, optional: true });
  }

  toJSON() {
    const { schema, ...rest } = this.state;
    return schema ? { ...rest, vendor: schema["~standard"].vendor } : rest;
  }
}

// oxlint-disable-next-line typescript/no-explicit-any -- matches any param
export type AnyParam = Param<any, Input, Presence>;
export type ParamsShape = Readonly<Record<string, AnyParam>>;

type ValueOf<X> = X extends Param<infer T, Input, Presence> ? T : never;
type InputOf<X> = X extends Param<unknown, infer I, Presence> ? I : never;
type PresenceOf<X> = X extends Param<unknown, Input, infer P> ? P : never;

type Simplify<T> = { [K in keyof T]: T[K] };

/** The values `render` accepts for a params shape. */
export type InputValues<S extends ParamsShape> = Simplify<
  {
    [K in keyof S as InputOf<S[K]> extends "required" ? K : never]: ValueOf<
      S[K]
    >;
  } & {
    [K in keyof S as InputOf<S[K]> extends "required" ? never : K]?: ValueOf<
      S[K]
    >;
  }
>;

/** The values a template receives, after defaults and placeholders. */
export type TemplateValues<S extends ParamsShape> = Simplify<
  {
    [K in keyof S as PresenceOf<S[K]> extends "present" ? K : never]: ValueOf<
      S[K]
    >;
  } & {
    [K in keyof S as PresenceOf<S[K]> extends "present" ? never : K]?: ValueOf<
      S[K]
    >;
  }
>;

const create = <T, I extends Input = "required">(
  state: ParamState<T>
): Param<T, I, I extends "required" ? "present" : "maybe"> =>
  new Param(state) as Param<T, I, I extends "required" ? "present" : "maybe">;

interface SecretOptions {
  /** Environment variable that holds the real value in tests and evals. */
  env?: string;
  /** Rendered when no value is given. */
  placeholder: string;
}

/** Param builders. */
export const p = {
  boolean: () => create<boolean>({ kind: "boolean", optional: false }),
  enum: <const V extends readonly [string, ...string[]]>(values: V) =>
    create<V[number]>({ kind: "enum", optional: false, values }),
  number: () => create<number>({ kind: "number", optional: false }),
  /** Any Standard Schema (Zod, Valibot, ArkType, ...). */
  schema: <S extends StandardSchemaV1>(schema: S) =>
    create<InferSchemaOutput<S>>({ kind: "schema", optional: false, schema }),
  /**
   * A credential such as an API token. It's optional at render time: without
   * a value it renders as its placeholder, so real secrets only appear when
   * you pass them explicitly.
   */
  secret: ({ env, placeholder }: SecretOptions) =>
    new Param<string, "optional", "present">({
      env,
      kind: "secret",
      optional: true,
      placeholder,
    }),
  string: () => create<string>({ kind: "string", optional: false }),
  url: () => create<string>({ kind: "url", optional: false }),
};
