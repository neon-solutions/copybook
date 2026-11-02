import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { defineCommand, p } from "@copybook/core";
import { describe, expect, it } from "vitest";

import { frontmatter } from "../src/frontmatter";
import { loadProject } from "../src/load";
import type { Project } from "../src/load";
import { compareSnapshots, writeSnapshots } from "../src/snapshot";
import { buildSnapshots } from "../src/validate";

const fixture = path.join(import.meta.dirname, "fixtures/basic");

const loadIntoTemp = async (): Promise<Project> => {
  const project = await loadProject(fixture);
  const snapshotsDir = await mkdtemp(
    path.join(os.tmpdir(), "copybook-snapshots-")
  );
  return { ...project, config: { ...project.config, snapshotsDir } };
};

describe("snapshots", () => {
  it("renders prompts as Markdown with embeds in the frontmatter", async () => {
    const project = await loadIntoTemp();
    const { issues, snapshots } = buildSnapshots(project);
    const greet = snapshots.find((snapshot) => snapshot.id === "fixture.greet");

    expect(issues).toStrictEqual([]);
    expect(greet?.content).toMatch(
      /^---\nid: fixture\.greet\nkind: prompt\nsource: src\/prompts\.ts#greet\nplacements: \[\]\nparams: \{\}\nembeds:\n {2}- fixture\.hello\nhash: sha256:[0-9a-f]{16}\n---\n\nRun this:\necho hello agent\n$/u
    );
  });

  it("uses a longer fence when the code has its own", async () => {
    const { snapshots } = buildSnapshots(await loadIntoTemp());
    const readme = snapshots.find(
      (snapshot) => snapshot.id === "fixture.readme"
    );

    expect(readme?.content).toContain(
      "````md\n```js\nconsole.log(1);\n```\n````"
    );
  });

  it("reports missing snapshots", async () => {
    const project = await loadIntoTemp();
    const { snapshots } = buildSnapshots(project);
    const status = await compareSnapshots(project.config, snapshots);

    expect(status.missing).toHaveLength(5);
  });

  it("reports changed and orphaned snapshots, and prunes orphans", async () => {
    const project = await loadIntoTemp();
    const { snapshots } = buildSnapshots(project);
    const { snapshotsDir } = project.config;

    await writeSnapshots(project.config, snapshots);
    await writeFile(path.join(snapshotsDir, "fixture.hello.md"), "stale");
    await writeFile(path.join(snapshotsDir, "fixture.gone.md"), "orphan");
    const status = await compareSnapshots(project.config, snapshots);

    expect(status.changed.map((change) => change.id)).toStrictEqual([
      "fixture.hello",
    ]);
    expect(status.orphaned).toStrictEqual(["fixture.gone"]);

    await writeSnapshots(project.config, snapshots, { prune: true });
    const after = await compareSnapshots(project.config, snapshots);
    const hello = await readFile(
      path.join(snapshotsDir, "fixture.hello.md"),
      "utf-8"
    );

    expect(after).toStrictEqual({ changed: [], missing: [], orphaned: [] });
    expect(hello).toContain("echo hello world");
  });
});

const projectWith = (
  definition: ReturnType<typeof defineCommand>
): Project => ({
  config: {
    content: [],
    file: "/copybook.config.ts",
    placements: { "docs/home": {} },
    root: "/",
    snapshotsDir: "/snapshots",
  },
  definitions: [{ definition, exportName: "x", file: "x.ts" }],
});

describe("validation", () => {
  it("flags params without examples and unknown placements", () => {
    const { issues } = buildSnapshots(
      projectWith(
        defineCommand({
          id: "broken",
          params: { name: p.string() },
          placements: ["docs/elsewhere"],
          template: (t, { name }) => t`echo ${name}`,
        })
      )
    );

    expect(issues.map((issue) => issue.message)).toStrictEqual([
      'Unknown placement "docs/elsewhere". Add it to placements in the config.',
      'Param "name" of "broken" needs an .example() or .default() to render a preview.',
    ]);
  });

  it("flags templates that render differently each time", () => {
    let count = 0;
    const { issues } = buildSnapshots(
      projectWith(
        defineCommand({
          id: "impure",
          template: () => {
            count += 1;
            return `echo ${count}`;
          },
        })
      )
    );

    expect(issues[0]?.message).toContain("Renders differently each time.");
  });
});

describe(frontmatter, () => {
  it("quotes values YAML would misread", () => {
    expect(
      frontmatter([
        ["plain", "a.b/c"],
        ["number", "123"],
        ["bool", "true"],
        ["spaced", "has: colon"],
        ["list", []],
        ["map", { "a b": "<x>" }],
      ])
    ).toBe(
      '---\nplain: a.b/c\nnumber: "123"\nbool: "true"\nspaced: "has: colon"\nlist: []\nmap:\n  "a b": "<x>"\n---\n'
    );
  });
});
