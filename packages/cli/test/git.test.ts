import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { removedSince } from "../src/changes";
import { CopybookError } from "../src/errors";
import { changedFiles, listFiles, showFile } from "../src/git";
import { loadProject } from "../src/load";
import { snapshotPath, writeSnapshots } from "../src/snapshot";
import { buildSnapshots } from "../src/validate";

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

const def = (id: string) =>
  `export const cmd = { [Symbol.for("copybook.def")]: true, id: ${JSON.stringify(id)}, kind: "command", params: {}, template: () => "echo hello", verify: "syntax" };\n`;

/** A committed project with one command snapshot. */
const committedProject = async (id = "site.old") => {
  const root = await mkdtemp(path.join(tmpdir(), "copybook-git-"));
  await Promise.all([
    writeFile(
      path.join(root, "copybook.config.mjs"),
      'export default { content: ["defs.mjs"] };\n'
    ),
    writeFile(path.join(root, "defs.mjs"), def(id)),
    writeFile(path.join(root, ".gitignore"), "node_modules/\n"),
  ]);
  git(root, "init", "-q", "-b", "main");
  const project = await loadProject(root);
  await writeSnapshots(project.config, buildSnapshots(project).snapshots);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "initial");
  return root;
};

describe("git base ref safety", () => {
  it("rejects option-like base refs without touching a victim file", async () => {
    const root = await committedProject();
    const victim = path.join(root, "victim.txt");
    await writeFile(victim, "keep me\n");
    const project = await loadProject(root);
    const base = `--output=${victim}`;
    const dir = project.config.snapshotsDir;

    await expect(changedFiles(root, dir, base)).rejects.toMatchObject({
      code: "INVALID_OPTION",
      message: `Invalid git ref "${base}": refs must not start with "-"`,
    });
    await expect(listFiles(root, base, dir)).rejects.toMatchObject({
      code: "INVALID_OPTION",
      message: `Invalid git ref "${base}": refs must not start with "-"`,
    });
    await expect(
      showFile(root, base, project.config.file)
    ).rejects.toMatchObject({
      code: "INVALID_OPTION",
      message: `Invalid git ref "${base}": refs must not start with "-"`,
    });
    await expect(readFile(victim, "utf-8")).resolves.toBe("keep me\n");
  });

  it("throws a friendly error when cwd is not a git repository", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "copybook-no-git-"));
    await mkdir(path.join(root, "snapshots"), { recursive: true });

    await expect(
      changedFiles(root, path.join(root, "snapshots"), "HEAD")
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof CopybookError &&
        error.code === "USAGE" &&
        /not a git repository/iu.test(error.message)
    );
  });

  it("throws when the base revision does not exist", async () => {
    const root = await committedProject();
    const project = await loadProject(root);

    await expect(
      listFiles(root, "no-such-ref", project.config.snapshotsDir)
    ).rejects.toMatchObject({
      code: "INVALID_OPTION",
      message: expect.stringMatching(/no-such-ref|unknown revision/iu),
    });
  });
});

describe("removedSince snapshot renames", () => {
  it("reports the old snapshot id when git records a rename", async () => {
    const root = await committedProject("site.old");
    const projectBefore = await loadProject(root);
    const oldPath = snapshotPath(projectBefore.config, "site.old");
    const newPath = snapshotPath(projectBefore.config, "site.new");

    git(root, "mv", oldPath, newPath);
    await writeFile(path.join(root, "defs.mjs"), def("site.new"));
    // Keep the renamed snapshot content so git still sees an R0xx rename.
    const status = git(root, "diff", "--name-status", "main");
    expect(status).toMatch(/R\d+\t.*site\.old\.md\t.*site\.new\.md/u);

    const project = await loadProject(root);
    await expect(removedSince(project, "main")).resolves.toStrictEqual([
      { id: "site.old" },
    ]);
  });
});
