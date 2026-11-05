import { collectCommands, renderExample, toText } from "@copybook/core";
import type { Definition, Node, Rendered, Verify } from "@copybook/core";

import type { LoadedDefinition } from "../load";
import { TIERS } from "./define";
import type { TestSpec, Tier } from "./define";
import type { TestCase } from "./types";

const RANK: Record<Tier, number> = { run: 2, syntax: 0, typecheck: 1 };
/** Shell code blocks in prompts get a syntax check. */
const PROMPT_SHELLS = new Set(["bash", "sh", "shell", "zsh"]);
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

interface ShellBlock {
  lang: string;
  text: string;
}

/**
 * Literal shell code blocks in a rendered tree, such as a fenced `bash`
 * block in a Markdown prompt. Embedded snippets are tested on their own.
 */
const shellBlocks = (rendered: Rendered): ShellBlock[] => {
  const blocks: ShellBlock[] = [];
  const visit = (nodes: readonly Node[]) => {
    for (const node of nodes) {
      if (node.type === "code") {
        const lang = node.lang?.toLowerCase() ?? "";
        if (node.id === undefined && PROMPT_SHELLS.has(lang)) {
          blocks.push({
            lang,
            text: toText(
              { id: "", kind: "snippet", nodes: node.children },
              { format: "plain" }
            ),
          });
        }
      } else if (node.type === "include") {
        visit(node.children);
      }
    }
  };
  visit(rendered.nodes);
  return blocks;
};

/**
 * Literal commands in a prompt, such as `t.cmd("npm run build")`, and its
 * literal shell code blocks get a syntax check.
 */
const promptCases = (
  definition: Definition,
  requested: readonly Tier[]
): TestCase[] => {
  if (!requested.includes("syntax")) {
    return [];
  }
  const rendered = renderExample(definition);
  const commands = collectCommands(rendered).flatMap((command, index) =>
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
  const blocks = shellBlocks(rendered).map((block, index) => ({
    definition,
    id: definition.id,
    label: `code block ${index + 1}`,
    lang: block.lang,
    text: block.text,
    tier: "syntax" as const,
  }));
  return [...commands, ...blocks];
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
