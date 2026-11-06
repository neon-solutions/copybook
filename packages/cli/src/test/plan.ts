import { definePrompt, renderExample, toText } from "@copybook/core";
import type { Definition, Node, Rendered, Verify } from "@copybook/core";

import type { LoadedDefinition } from "../load";
import { TIERS } from "./define";
import type { TestSpec, Tier } from "./define";
import type { TestCase } from "./types";

const RANK: Record<Tier, number> = { run: 2, syntax: 0, typecheck: 1 };
/** Shell code blocks in prompts get a syntax check. */
const PROMPT_SHELLS = new Set(["bash", "sh", "shell", "zsh"]);
/**
 * A placeholder such as `<project-name>` that a prompt asks the agent to
 * fill in. A shell reads it as a redirect, so the check sees a word instead.
 */
const PLACEHOLDER = /<(?<name>[A-Za-z][\w-]*)>/gu;
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

interface PromptCheck {
  kind: "cmd" | "code block";
  lang: string;
  text: string;
}

const plainText = (nodes: readonly Node[]) =>
  toText({ id: "", kind: "snippet", nodes: [...nodes] }, { format: "plain" });

/**
 * The literal commands and shell code blocks a prompt shows, once each.
 * Embedded definitions, and included ones the project loads, get their own
 * cases. A command inside a shell block is checked with the block.
 */
const promptChecks = (
  rendered: Rendered,
  loaded: ReadonlySet<string>
): PromptCheck[] => {
  const checks: PromptCheck[] = [];
  const seen = new Set<string>();
  const add = (check: PromptCheck) => {
    const key = `${check.lang}\n${check.text}`;
    if (!seen.has(key)) {
      seen.add(key);
      checks.push(check);
    }
  };
  const visit = (nodes: readonly Node[]) => {
    for (const node of nodes) {
      if (node.type === "command" && node.id === undefined) {
        add({ kind: "cmd", lang: "bash", text: plainText(node.children) });
      } else if (node.type === "code" && node.id === undefined) {
        const lang = node.lang?.toLowerCase() ?? "";
        if (PROMPT_SHELLS.has(lang)) {
          add({ kind: "code block", lang, text: plainText(node.children) });
        } else {
          visit(node.children);
        }
      } else if (node.type === "include" && !loaded.has(node.id)) {
        visit(node.children);
      }
    }
  };
  visit(rendered.nodes);
  return checks;
};

/**
 * A prompt rendered for checks. A Markdown prompt with Windows line endings
 * keeps its fences as text, so its checks come from the same text with
 * `\n` line endings.
 */
const renderForChecks = (definition: Definition) =>
  definition.kind === "prompt" && definition.markdown?.includes("\r\n")
    ? renderExample(
        definePrompt({
          id: definition.id,
          markdown: definition.markdown.replaceAll("\r\n", "\n"),
        })
      )
    : renderExample(definition);

/**
 * Literal commands in a prompt, such as `t.cmd("npm run build")`, and its
 * literal shell code blocks get a syntax check, with placeholders such as
 * `<agent>` read as plain words.
 */
const promptCases = (
  definition: Definition,
  requested: readonly Tier[],
  loaded: ReadonlySet<string>
): TestCase[] => {
  if (!requested.includes("syntax")) {
    return [];
  }
  const counts = { cmd: 0, "code block": 0 };
  return promptChecks(renderForChecks(definition), loaded).map((check) => {
    counts[check.kind] += 1;
    return {
      definition,
      id: definition.id,
      label: `${check.kind} ${counts[check.kind]}`,
      lang: check.lang,
      text: check.text.replaceAll(PLACEHOLDER, "$<name>"),
      tier: "syntax" as const,
    };
  });
};

/** Decides which tiers each definition and variant gets. */
export const buildPlan = (
  definitions: readonly LoadedDefinition[],
  specs: readonly TestSpec[],
  requested: readonly Tier[] = TIERS
): TestCase[] => {
  const specsById = new Map(specs.map((spec) => [spec.id, spec]));
  const loaded = new Set(definitions.map(({ definition }) => definition.id));
  const cases: TestCase[] = [];

  for (const { definition } of definitions) {
    const spec = specsById.get(definition.id);
    const withSpec = (testCase: TestCase): TestCase =>
      spec ? { ...testCase, spec } : testCase;

    if (definition.kind === "prompt") {
      cases.push(...promptCases(definition, requested, loaded));
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
