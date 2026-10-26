import { collectCommands, renderExample } from "@prompt-manager/core";
import type { Definition, Verify } from "@prompt-manager/core";

import type { LoadedDefinition } from "../load";
import { TIERS } from "./define";
import type { TestSpec, Tier } from "./define";
import type { TestCase } from "./types";

const RANK: Record<Tier, number> = { run: 2, syntax: 0, typecheck: 1 };
const TYPECHECKABLE = new Set(["javascript", "js", "mjs", "ts", "typescript"]);
const RUNNABLE = new Set([
  "bash",
  "javascript",
  "js",
  "mjs",
  "py",
  "python",
  "sh",
  "shell",
  "ts",
  "typescript",
  "zsh",
]);

const tiersFor = (
  verify: Verify,
  lang: string | undefined,
  requested: readonly Tier[]
) => {
  if (typeof verify === "object") {
    return [];
  }
  const language = (lang ?? "").toLowerCase();
  return requested.filter((tier) => {
    if (RANK[tier] > RANK[verify]) {
      return false;
    }
    if (tier === "typecheck") {
      return TYPECHECKABLE.has(language);
    }
    return tier === "run" ? RUNNABLE.has(language) : true;
  });
};

const skipReason = (verify: Verify) =>
  typeof verify === "object" ? verify.skip : undefined;

const commandCases = (
  definition: Definition,
  verify: Verify,
  requested: readonly Tier[]
) => {
  const reason = skipReason(verify);
  if (reason) {
    return [
      {
        definition,
        id: definition.id,
        lang: "bash",
        skip: reason,
        tier: "syntax" as const,
      },
    ];
  }
  return tiersFor(verify, "bash", requested).map((tier) => ({
    definition,
    id: definition.id,
    lang: "bash",
    tier,
  }));
};

/** Literal commands in a prompt, such as `t.cmd("npm run build")`, get a syntax check. */
const promptCases = (
  definition: Definition,
  requested: readonly Tier[]
): TestCase[] => {
  if (!requested.includes("syntax")) {
    return [];
  }
  const commands = collectCommands(renderExample(definition));
  return commands.flatMap((command, index) =>
    command.id
      ? []
      : [
          {
            definition,
            id: definition.id,
            label: `cmd ${index + 1}`,
            lang: "bash",
            text: command.text,
            tier: "syntax" as const,
          },
        ]
  );
};

/** Decides which tiers each definition and variant gets. */
export const buildPlan = (
  definitions: readonly LoadedDefinition[],
  specs: readonly TestSpec[],
  requested: readonly Tier[] = TIERS
): TestCase[] => {
  const specsById = new Map(specs.map((spec) => [spec.id, spec]));
  const cases: TestCase[] = [];

  for (const { definition } of definitions) {
    const spec = specsById.get(definition.id);
    const withSpec = (testCase: TestCase): TestCase =>
      spec ? { ...testCase, spec } : testCase;

    if (definition.kind === "prompt") {
      cases.push(...promptCases(definition, requested));
      continue;
    }
    if (definition.kind === "command") {
      cases.push(
        ...commandCases(definition, definition.verify, requested).map(withSpec)
      );
      continue;
    }
    for (const variant of definition.variants) {
      const verify = variant.verify ?? definition.verify;
      const base = {
        definition,
        id: definition.id,
        ...(variant.deps ? { deps: variant.deps } : {}),
        ...(variant.lang ? { lang: variant.lang } : {}),
        ...(variant.key === "" ? {} : { variant: variant.key }),
      };
      const reason = skipReason(verify);
      if (reason) {
        cases.push({ ...base, skip: reason, tier: "syntax" });
        continue;
      }
      const onlyVariants = spec?.options.variants;
      for (const tier of tiersFor(verify, variant.lang, requested)) {
        const excluded =
          tier === "run" && onlyVariants && !onlyVariants.includes(variant.key);
        if (!excluded) {
          cases.push(withSpec({ ...base, tier }));
        }
      }
    }
  }
  return cases;
};
