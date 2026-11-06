import type { LoadedDefinition } from "../load";
import type { EvalSpec } from "./define";
import type { EvalTarget } from "./runner";

interface SelectOptions {
  /** Ids whose rendered output changed, for `--changed`. */
  changed?: ReadonlySet<string>;
  /** Snapshot hash per id, so unchanged prompts can be skipped. */
  hashes: ReadonlyMap<string, string>;
  /** Ids from `--only`. */
  only?: ReadonlySet<string>;
}

/**
 * The prompts to evaluate, and warnings for `--only` ids without an eval
 * and for evals whose id isn't a prompt, which are skipped.
 */
export const selectEvalTargets = (
  definitions: readonly LoadedDefinition[],
  specs: readonly EvalSpec[],
  { changed, hashes, only }: SelectOptions
): { targets: EvalTarget[]; warnings: string[] } => {
  const prompts = new Map(
    definitions
      .filter(({ definition }) => definition.kind === "prompt")
      .map(({ definition }) => [definition.id, definition])
  );
  const warnings = [
    ...[...(only ?? [])]
      .filter((id) => !specs.some((spec) => spec.id === id))
      .map((id) => `No eval for "${id}".`),
    ...specs
      .filter((spec) => !prompts.has(spec.id))
      .map(
        (spec) =>
          `The eval for "${spec.id}" has no prompt with that id, so it's skipped.`
      ),
  ];
  const targets = specs.flatMap((spec) => {
    const definition = prompts.get(spec.id);
    const selected =
      (!only || only.has(spec.id)) && (!changed || changed.has(spec.id));
    return definition && selected
      ? [{ contentHash: hashes.get(spec.id) ?? "", definition, spec }]
      : [];
  });
  return { targets, warnings };
};
