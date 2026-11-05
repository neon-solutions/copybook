import { listVariants } from "@copybook/core";
import type { Verify } from "@copybook/core";

import { sourceLabel } from "./load";
import type { LoadedDefinition } from "./load";
import type { Snapshot } from "./snapshot";

export interface ManifestVariant {
  deps?: { npm?: readonly string[]; pip?: readonly string[] };
  key: string;
  label: string;
  lang?: string;
  verify?: Verify;
  when: Readonly<Record<string, string>>;
}

export interface ManifestEntry {
  aliases: readonly string[];
  description?: string;
  embeds: string[];
  hash: string;
  id: string;
  kind: "command" | "prompt" | "snippet";
  owners: readonly string[];
  params: Record<string, unknown>;
  placements: readonly string[];
  source: { export: string; file: string };
  tags: readonly string[];
  title?: string;
  variants?: ManifestVariant[];
  verify?: Verify;
}

export interface Manifest {
  definitions: ManifestEntry[];
  version: 1;
}

const variantsOf = (
  loaded: LoadedDefinition
): ManifestVariant[] | undefined => {
  const { definition } = loaded;
  if (definition.kind !== "snippet") {
    return;
  }
  const labels = new Map(
    listVariants(definition).map((variant) => [variant.key, variant.label])
  );
  return definition.variants.map((variant) => ({
    key: variant.key,
    label: labels.get(variant.key) ?? "",
    when: variant.when,
    ...(variant.deps ? { deps: variant.deps } : {}),
    ...(variant.lang ? { lang: variant.lang } : {}),
    ...(variant.verify ? { verify: variant.verify } : {}),
  }));
};

/** Where an entry is declared: `file#export`, or just the file for Markdown. */
export const entrySource = ({ source }: Pick<ManifestEntry, "source">) =>
  sourceLabel({ exportName: source.export, file: source.file });

/** A JSON description of every definition, for tools and Studio. */
export const buildManifest = (
  definitions: readonly LoadedDefinition[],
  snapshots: readonly Snapshot[]
): Manifest => {
  const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  return {
    definitions: definitions.map((loaded) => {
      const { definition } = loaded;
      const snapshot = byId.get(definition.id);
      const variants = variantsOf(loaded);
      return {
        aliases: definition.aliases ?? [],
        embeds: snapshot?.embeds ?? [],
        hash: snapshot?.hash ?? "",
        id: definition.id,
        kind: definition.kind,
        owners: definition.owners ?? [],
        params: Object.fromEntries(
          Object.entries(definition.params).map(([name, param]) => [
            name,
            param.toJSON(),
          ])
        ),
        placements: definition.placements ?? [],
        source: { export: loaded.exportName, file: loaded.file },
        tags: definition.tags ?? [],
        ...(definition.description
          ? { description: definition.description }
          : {}),
        ...(definition.title ? { title: definition.title } : {}),
        ...(variants ? { variants } : {}),
        ...("verify" in definition ? { verify: definition.verify } : {}),
      };
    }),
    version: 1,
  };
};
