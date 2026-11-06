import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { changedIds, removedSince } from "../src/changes";
import { fileHistory } from "../src/git";
import { loadProject } from "../src/load";
import {
  compareSnapshots,
  snapshotFile,
  snapshotPath,
  writeSnapshots,
} from "../src/snapshot";
import { buildSnapshots } from "../src/validate";

const config = (meta: Record<string, unknown> = {}) => `export default {
  content: ["defs.mjs"],
  markdown: [{ dir: "prompts", idPrefix: "site.prompts", meta: ${JSON.stringify(meta)} }],
};
`;

const DEFS =
  'export const hello = { [Symbol.for("copybook.def")]: true, id: "site.hello", kind: "command", params: {}, template: () => "echo hello", verify: "syntax" };\n';

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Copybook",
      "-c",
      "user.email=copybook@example.com",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd, encoding: "utf-8" }
  );

/** A committed project with one command and two Markdown prompts. */
const committedProject = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "copybook-md-snap-"));
  await mkdir(path.join(root, "prompts"));
  await Promise.all([
    writeFile(path.join(root, "copybook.config.mjs"), config()),
    writeFile(path.join(root, "defs.mjs"), DEFS),
    writeFile(path.join(root, ".gitignore"), "node_modules/\n"),
    writeFile(path.join(root, "prompts/setup.md"), "Set me up.\n"),
    writeFile(path.join(root, "prompts/connect.md"), "Connect me.\n"),
    writeFile(path.join(root, "prompts/notes.txt"), "Not a prompt.\n"),
  ]);
  git(root, "init", "-q", "-b", "main");
  const project = await loadProject(root);
  await writeSnapshots(project.config, buildSnapshots(project).snapshots);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "initial");
  return root;
};

describe("Markdown files as their own snapshots", () => {
  it("points the snapshot at the file instead of a copy", async () => {
    const root = await committedProject();
    const project = await loadProject(root);
    const { issues, snapshots } = buildSnapshots(project);
    const setup = snapshots.find((item) => item.id === "site.prompts.setup");
    const source = path.join(root, "prompts/setup.md");

    expect(issues).toStrictEqual([]);
    expect(setup).toMatchObject({
      content: "Set me up.\n",
      inSource: true,
      path: source,
    });
    expect(snapshotFile(project.config, snapshots, "site.prompts.setup")).toBe(
      source
    );
    expect(snapshotFile(project.config, snapshots, "site.hello")).toBe(
      snapshotPath(project.config, "site.hello")
    );
    expect(
      existsSync(snapshotPath(project.config, "site.prompts.setup"))
    ).toBeFalsy();
  });

  it("never reports an edited prompt as stale or writes to it", async () => {
    const root = await committedProject();
    const source = path.join(root, "prompts/setup.md");
    await writeFile(source, "Set me up, please.\n");
    const project = await loadProject(root);
    const { snapshots } = buildSnapshots(project);
    const status = await writeSnapshots(project.config, snapshots, {
      prune: true,
    });

    expect(status).toStrictEqual({ changed: [], missing: [], orphaned: [] });
    await expect(readFile(source, "utf-8")).resolves.toBe(
      "Set me up, please.\n"
    );
  });

  it("flags a stray copy under the snapshots dir as orphaned", async () => {
    const root = await committedProject();
    const project = await loadProject(root);
    const { snapshots } = buildSnapshots(project);
    await writeFile(
      snapshotPath(project.config, "site.prompts.setup"),
      "a copy"
    );

    const status = await compareSnapshots(project.config, snapshots);

    expect(status.orphaned).toStrictEqual(["site.prompts.setup"]);
  });

  it("reports edited prompts as changed since the base", async () => {
    const root = await committedProject();
    await writeFile(path.join(root, "prompts/connect.md"), "Connect it.\n");
    await writeFile(path.join(root, "prompts/notes.txt"), "Still not.\n");
    await writeFile(path.join(root, "prompts/new.md"), "New.\n");
    const project = await loadProject(root);
    const { snapshots } = buildSnapshots(project);

    await expect(changedIds(project, snapshots, "main")).resolves.toStrictEqual(
      ["site.prompts.connect", "site.prompts.new"]
    );
  });

  it("reports deleted prompts unless an alias keeps the id", async () => {
    const root = await committedProject();
    await rm(path.join(root, "prompts/connect.md"));
    await rm(path.join(root, "prompts/notes.txt"));
    git(root, "mv", "prompts/setup.md", "prompts/start.md");
    await writeFile(
      path.join(root, "copybook.config.mjs"),
      config({ "start.md": { aliases: ["site.prompts.setup"] } })
    );
    const project = await loadProject(root);

    await expect(removedSince(project, "main")).resolves.toStrictEqual([
      { file: "prompts/connect.md", id: "site.prompts.connect" },
    ]);
  });

  it("reads history from the file's own commits", async () => {
    const root = await committedProject();
    await writeFile(path.join(root, "prompts/setup.md"), "Set me up now.\n");
    git(root, "commit", "-q", "-am", "Reword the setup prompt");
    const project = await loadProject(root);
    const { snapshots } = buildSnapshots(project);
    const history = await fileHistory(
      root,
      snapshotFile(project.config, snapshots, "site.prompts.setup")
    );

    expect(history.map((commit) => commit.subject)).toStrictEqual([
      "Reword the setup prompt",
      "initial",
    ]);
  });

  it("reads the base's ids with its config, so an idPrefix change shows", async () => {
    const root = await committedProject();
    await writeFile(
      path.join(root, "copybook.config.mjs"),
      config().replace('idPrefix: "site.prompts"', 'idPrefix: "docs.prompts"')
    );
    const project = await loadProject(root);
    const { snapshots } = buildSnapshots(project);
    const removed = await removedSince(project, "main");

    expect(removed.map(({ id }) => id)).toStrictEqual([
      "site.prompts.connect",
      "site.prompts.setup",
    ]);
    await expect(changedIds(project, snapshots, "main")).resolves.toStrictEqual(
      ["docs.prompts.connect", "docs.prompts.setup"]
    );
  });

  it("reports every prompt of a removed source, with its URL", async () => {
    const root = await committedProject();
    await writeFile(
      path.join(root, "copybook.config.mjs"),
      config().replace(
        'idPrefix: "site.prompts"',
        'idPrefix: "site.prompts", url: "/prompts"'
      )
    );
    git(root, "commit", "-q", "-am", "Serve the prompts");
    await writeFile(
      path.join(root, "copybook.config.mjs"),
      'export default { content: ["defs.mjs"] };\n'
    );
    const project = await loadProject(root);

    await expect(removedSince(project, "HEAD")).resolves.toStrictEqual([
      {
        file: "prompts/connect.md",
        id: "site.prompts.connect",
        url: "/prompts/connect.md",
      },
      {
        file: "prompts/setup.md",
        id: "site.prompts.setup",
        url: "/prompts/setup.md",
      },
    ]);
  });
});
