import os from "node:os";

import { describe, expect, it } from "vitest";

import { exec } from "../src/test/exec";

describe(exec, () => {
  it("survives a process that exits without reading its input", async () => {
    // More than a pipe buffer holds, so the write fails with EPIPE.
    const input = "x".repeat(1024 * 1024);
    const result = await exec("bash", ["-c", "exit 3"], {
      cwd: os.tmpdir(),
      input,
    });

    expect(result.code).toBe(3);
  });
});
