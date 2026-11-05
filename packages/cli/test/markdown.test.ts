import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { renderExample, toText } from "@copybook/core";
import { describe, expect, it } from "vitest";

import { loadAnalysis } from "../src/analysis";
import { definitionDetail, definitionMarkdown } from "../src/detail";
import { loadProject } from "../src/load";

const fixture = path.join(import.meta.dirname, "fixtures/markdown");

const loadedById = async (id: string) => {
  const project = await loadProject(fixture);
  return project.definitions.find((loaded) => loaded.definition.id === id);
};

/** A project in a temp dir with the given config and files. */
const tempProject = async (
  config: string,
  files: Readonly<Record<string, string>>
) => {
  const root = await mkdtemp(path.join(tmpdir(), "copybook-md-"));
  await writeFile(path.join(root, "copybook.config.mjs"), config);
  await Promise.all(
    Object.entries(files).map(async ([file, text]) => {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), text);
    })
  );
  return root;
};

describe("Markdown sources", () => {
  it("loads each file as a prompt with an id from its path", async () => {
    const project = await loadProject(fixture);

    expect(
      project.definitions.map(({ definition, exportName, file, markdown }) => [
        definition.id,
        definition.kind,
        file,
        exportName,
        markdown?.url,
      ])
    ).toStrictEqual([
      ["fixture.notes.release", "prompt", "notes/release.md", "", undefined],
      [
        "fixture.prompts.guides.connect",
        "prompt",
        "prompts/guides/connect.md",
        "",
        "/prompts/guides/connect.md",
      ],
      [
        "fixture.prompts.setup",
        "prompt",
        "prompts/setup.md",
        "",
        "/prompts/setup.md",
      ],
    ]);
  });

  it("keeps frontmatter in the prompt and renders the file exactly", async () => {
    const setup = await loadedById("fixture.prompts.setup");
    const text = await readFile(
      path.join(fixture, "prompts/setup.md"),
      "utf-8"
    );

    expect(setup?.markdown?.text).toBe(text);
    expect(setup && toText(renderExample(setup.definition))).toBe(text);
    expect(setup?.definition).toMatchObject({
      description: "Install the Acme CLI and sign in.",
      owners: ["docs"],
      placements: ["docs/setup"],
      title: "Set up Acme for your coding agent",
    });
  });

  it("takes the title from the first heading", async () => {
    const connect = await loadedById("fixture.prompts.guides.connect");

    expect(connect?.definition.title).toBe("Connect your app to Acme");
    expect(connect?.definition.placements).toBeUndefined();
  });

  it("reads metadata from stripped frontmatter", async () => {
    const release = await loadedById("fixture.notes.release");

    expect(release?.definition).toMatchObject({
      aliases: ["fixture.notes.changelog"],
      placements: ["docs/notes"],
      tags: ["release"],
      title: "Write the release notes",
    });
    expect(release && toText(renderExample(release.definition))).toBe(
      "Summarize the merged pull requests since the last tag.\n"
    );
  });

  it("rejects file names that aren't valid ids", async () => {
    const root = await tempProject(
      'export default { markdown: [{ dir: "prompts", idPrefix: "site" }] };',
      { "prompts/Set Up.md": "Hi" }
    );

    await expect(loadProject(root)).rejects.toThrow(
      'Couldn\'t load prompts/Set Up.md: Invalid definition id "site.Set Up".'
    );
  });

  it("rejects a missing dir and meta for files it doesn't have", async () => {
    const missingDir = await tempProject(
      'export default { markdown: [{ dir: "nope", idPrefix: "site" }] };',
      {}
    );
    const unknownMeta = await tempProject(
      'export default { markdown: [{ dir: "prompts", idPrefix: "site", meta: { "gone.md": {} } }] };',
      { "prompts/here.md": "Hi" }
    );

    await expect(loadProject(missingDir)).rejects.toThrow(
      'markdown[0].dir "nope" doesn\'t exist.'
    );
    await expect(loadProject(unknownMeta)).rejects.toThrow(
      "markdown[0].meta lists files that prompts doesn't have: gone.md."
    );
  });

  it("rejects bad stripped frontmatter but keeps bad kept frontmatter as text", async () => {
    const strip = await tempProject(
      'export default { markdown: [{ dir: "p", frontmatter: "strip", idPrefix: "site" }] };',
      { "p/a.md": "---\ntags: release\n---\nHi" }
    );
    const keep = await tempProject(
      'export default { markdown: [{ dir: "p", idPrefix: "site" }] };',
      { "p/a.md": "---\ntitle: [unclosed\n---\n# Heading\n" }
    );

    await expect(loadProject(strip)).rejects.toThrow(
      'Couldn\'t load p/a.md: Its frontmatter "tags" must be a list of strings.'
    );
    const kept = await loadProject(keep);
    const [loaded] = kept.definitions;

    expect(loaded?.definition.title).toBe("Heading");
  });

  it("rejects an id that a content file also defines", async () => {
    const root = await tempProject(
      'export default { content: ["defs.mjs"], markdown: [{ dir: "p", idPrefix: "site" }] };',
      {
        "defs.mjs":
          'export const dupe = { [Symbol.for("copybook.def")]: true, id: "site.a", kind: "prompt", params: {}, template: () => "" };',
        "p/a.md": "Hi",
      }
    );

    await expect(loadProject(root)).rejects.toThrow(
      'Duplicate id "site.a" in defs.mjs#dupe and p/a.md.'
    );
  });

  it("shows the file as the source and the snapshot", async () => {
    const analysis = await loadAnalysis(fixture);
    const detail = await definitionDetail(analysis, "fixture.prompts.setup");

    expect(detail.snapshotFile).toBe("prompts/setup.md");
    expect(definitionMarkdown(detail)).toContain(
      "- Source: `prompts/setup.md`\n"
    );
  });
});
