import { describe, expect, it } from "vitest";

import { buildCatalog, COMMAND_META } from "../src/catalog";
import { createProgram } from "../src/program";

describe(buildCatalog, () => {
  const program = createProgram();
  const catalog = buildCatalog(program);

  it("has metadata for exactly the registered commands", () => {
    const registered = program.commands
      .map((command) => command.name())
      .toSorted();

    expect(Object.keys(COMMAND_META).toSorted()).toStrictEqual(registered);
    expect(
      catalog.commands.map((command) => command.name).toSorted()
    ).toStrictEqual(registered);
  });

  it("describes arguments, flags, defaults, and allowed values", () => {
    const test = catalog.commands.find((command) => command.name === "test");
    const show = catalog.commands.find((command) => command.name === "show");

    expect(test?.options).toContainEqual(
      expect.objectContaining({
        default: "pretty",
        long: "--reporter",
        values: ["pretty", "json", "junit"],
      })
    );
    expect(show?.arguments).toStrictEqual([
      expect.objectContaining({ name: "id", required: true }),
    ]);
    expect(show?.docs).toBe("https://copybook.dev/docs/reference/cli#show");
  });

  it("keeps evals CI-only and every JSON command marked", () => {
    const byName = new Map(
      catalog.commands.map((command) => [command.name, command])
    );

    expect(byName.get("eval")?.agent).toBe("ci-only");
    for (const command of catalog.commands) {
      expect(command.options.some((option) => option.long === "--json")).toBe(
        command.json
      );
    }
  });
});
