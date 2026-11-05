import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const packageDir = path.join(import.meta.dirname, "..");

// Loads the built package by name, the way a consumer would.
const SCRIPT = `
const { definePrompt, render, toText } = require("@copybook/core");
const prompt = definePrompt({ id: "cjs.prompt", markdown: "Hi agent" });
process.stdout.write(toText(render(prompt)));
`;

describe("package exports", () => {
  it("loads from CommonJS with require()", () => {
    const output = execFileSync(
      process.execPath,
      ["--input-type=commonjs", "--eval", SCRIPT],
      { cwd: packageDir, encoding: "utf-8" }
    );

    expect(output).toBe("Hi agent");
  });
});
