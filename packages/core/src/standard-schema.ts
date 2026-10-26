/**
 * The Standard Schema interface (https://standardschema.dev), copied as types
 * only so core stays dependency-free. Zod, Valibot, ArkType, and others
 * implement it.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly types?: { readonly input: Input; readonly output: Output };
    readonly vendor: string;
    readonly version: 1;
  };
}

export type InferSchemaOutput<Schema extends StandardSchemaV1> = NonNullable<
  Schema["~standard"]["types"]
>["output"];
