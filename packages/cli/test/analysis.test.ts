import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { defineCommand } from "@copybook/core";
import { describe, expect, it } from "vitest";

import {
  analyzeProject,
  checkIssues,
  findDefinition,
  searchDefinitions,
  suggestIds,
} from "../src/analysis";
import { loadProject } from "../src/load";
import type { Project } from "../src/load";
import { snapshotPath, writeSnapshots } from "../src/snapshot";
import { buildSnapshots } from "../src/validate";

const fixture = path.join(import.meta.dirname, "fixtures/basic");

const loadIntoTemp = async (): Promise<Project> => {
  const project = await loadProject(fixture);
  const snapshotsDir = await mkdtemp(
    path.join(os.tmpdir(), "copybook-analysis-")
  );
  return { ...project, config: { ...project.config, snapshotsDir } };
};

describe(analyzeProject, () => {
  it("adds snapshot state, embedders, and rendering files", async () => {
    const { entries } = await analyzeProject(await loadIntoTemp());
    const hello = entries.find((entry) => entry.id === "fixture.hello");
    const greet = entries.find((entry) => entry.id === "fixture.greet");

    expect(hello).toMatchObject({
      snapshot: "missing",
      usedBy: ["fixture.greet"],
    });
    expect(greet?.renderedIn).toStrictEqual(["app/page.tsx"]);
  });
});

describe(checkIssues, () => {
  it("codes every issue", async () => {
    const analysis = await analyzeProject(await loadIntoTemp());
    const issues = await checkIssues(analysis);

    expect(
      issues.filter((issue) => issue.code === "snapshot-missing")
    ).toHaveLength(analysis.entries.length);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "unused",
        id: "fixture.readme",
        level: "warning",
      })
    );
  });

  it("reports stale and orphaned snapshots", async () => {
    const project = await loadIntoTemp();
    await writeSnapshots(project.config, buildSnapshots(project).snapshots);
    await writeFile(snapshotPath(project.config, "fixture.hello"), "stale\n");
    await writeFile(snapshotPath(project.config, "fixture.gone"), "gone\n");

    const issues = await checkIssues(await analyzeProject(project));
    const codes = issues.map((issue) => `${issue.code} ${issue.id}`);

    expect(codes).toContain("snapshot-changed fixture.hello");
    expect(codes).toContain("snapshot-orphaned fixture.gone");
  });
});

describe(findDefinition, () => {
  const renamed = defineCommand({
    aliases: ["old.hello"],
    id: "new.hello",
    template: (t) => t`echo hello`,
  });

  const withRenamed = async () => {
    const project = await loadIntoTemp();
    return analyzeProject({
      ...project,
      definitions: [
        ...project.definitions,
        { definition: renamed, exportName: "renamed", file: "src/renamed.ts" },
      ],
    });
  };

  it("finds definitions by id and by alias", async () => {
    const analysis = await withRenamed();

    expect(findDefinition(analysis, "new.hello")?.via).toBeUndefined();
    expect(findDefinition(analysis, "old.hello")).toMatchObject({
      entry: { id: "new.hello" },
      via: "alias",
    });
    expect(findDefinition(analysis, "nope")).toBeUndefined();
  });

  it("suggests close ids", async () => {
    expect(suggestIds(await withRenamed(), "fixture.helo")).toContain(
      "fixture.hello"
    );
  });
});

describe(searchDefinitions, () => {
  it("matches rendered output as well as metadata", async () => {
    const analysis = await analyzeProject(await loadIntoTemp());
    const ids = (query: string) =>
      searchDefinitions(analysis, query).map((entry) => entry.id);

    expect(ids("echo hello")).toContain("fixture.hello");
    expect(ids("docs/home")).toStrictEqual(["fixture.hello"]);
  });
});
