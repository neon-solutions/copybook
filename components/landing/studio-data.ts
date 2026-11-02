import { collectEmbeds, listVariants, render } from "@copybook/core";
import type {
  AnyParam,
  CommandDefinition,
  PromptDefinition,
  Rendered,
  SnippetDefinition,
  Verify,
} from "@copybook/core";
import { tryIt } from "@copybook/example-acme/ai-gateway";
import {
  deploy,
  init,
  install,
  login,
  psql,
} from "@copybook/example-acme/commands";
import { connect } from "@copybook/example-acme/connect";
import { setUpWithAgent } from "@copybook/example-acme/create-project";

type Definition = CommandDefinition | PromptDefinition | SnippetDefinition;

export type ParamInfo = ReturnType<AnyParam["toJSON"]>;

/** One Acme definition, as Studio lists it. */
export interface StudioEntry {
  definition: Definition;
  /** `file#export`, as Studio shows it. */
  source: string;
}

export const ENTRIES: readonly StudioEntry[] = [
  {
    definition: setUpWithAgent,
    source: "src/create-project.ts#setUpWithAgent",
  },
  { definition: connect, source: "src/connect.ts#connect" },
  { definition: tryIt, source: "src/ai-gateway.ts#tryIt" },
  { definition: install, source: "src/commands.ts#install" },
  { definition: login, source: "src/commands.ts#login" },
  { definition: init, source: "src/commands.ts#init" },
  { definition: deploy, source: "src/commands.ts#deploy" },
  { definition: psql, source: "src/commands.ts#psql" },
];

export const paramInfo = (definition: Definition): Record<string, ParamInfo> =>
  Object.fromEntries(
    Object.entries(definition.params as Record<string, AnyParam>).map(
      ([name, param]) => [name, param.toJSON()]
    )
  );

/** Form values start from each param's example, then its default. */
export const initialValues = (
  params: Record<string, ParamInfo>
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(params).map(([name, param]) => {
      const value = param.example ?? param.default;
      return [name, value === undefined ? "" : String(value)];
    })
  );

/** Converts form strings back to param types, dropping empty values. */
export const toParamValues = (
  params: Record<string, ParamInfo>,
  values: Record<string, string>
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [name, param] of Object.entries(params)) {
    const value = values[name] ?? "";
    if (value === "") {
      continue;
    }
    if (param.kind === "number") {
      result[name] = Number(value);
    } else if (param.kind === "boolean") {
      result[name] = value === "true";
    } else {
      result[name] = value;
    }
  }
  return result;
};

export interface PreviewItem {
  key: string;
  label: string;
  rendered: Rendered;
}

/** Every variant rendered with `values`, the way Studio's preview does. */
export const renderPreview = (
  definition: Definition,
  values: Record<string, unknown>
): PreviewItem[] => {
  if (definition.kind !== "snippet") {
    return [
      {
        key: "default",
        label: definition.kind === "command" ? "Command" : "Prompt",
        rendered: render(definition, values),
      },
    ];
  }
  return listVariants(definition).map((variant) => ({
    key: variant.key,
    label: variant.label,
    rendered: render(definition, values, { variant: variant.key }),
  }));
};

const describe = (verify: Verify) =>
  typeof verify === "string" ? verify : `skipped: ${verify.skip}`;

/** What `copybook test` and `copybook eval` run for each variant. */
export const checksFor = (
  definition: Definition
): { label: string; check: string }[] => {
  if (definition.kind === "prompt") {
    return [
      // From examples/acme/verify/create-project.verify.ts.
      { check: "eval: 3 trials per agent, needs 67%", label: "Agents" },
      { check: "embedded commands tested", label: "Commands" },
    ];
  }
  if (definition.kind === "command") {
    return [{ check: describe(definition.verify), label: "Command" }];
  }
  const labels = new Map(
    listVariants(definition).map((variant) => [variant.key, variant.label])
  );
  return definition.variants.map((variant) => ({
    check: describe(variant.verify ?? definition.verify),
    label: labels.get(variant.key) ?? variant.key,
  }));
};

/** The ids each definition embeds, from its example render. */
export const EMBEDS: ReadonlyMap<string, readonly string[]> = new Map(
  ENTRIES.map(({ definition }) => {
    const params = paramInfo(definition);
    const examples = toParamValues(params, initialValues(params));
    const ids = renderPreview(definition, examples).flatMap((item) =>
      collectEmbeds(item.rendered)
    );
    return [definition.id, [...new Set(ids)]];
  })
);

export const usedBy = (id: string) =>
  ENTRIES.filter(({ definition }) =>
    EMBEDS.get(definition.id)?.includes(id)
  ).map(({ definition }) => definition.id);
