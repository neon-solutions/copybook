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

  it("times out without hanging when grandchildren hold stdio open", async () => {
    const started = performance.now();
    const result = await exec("bash", ["-eo", "pipefail"], {
      cwd: os.tmpdir(),
      input: "sleep 30\n",
      timeoutMs: 200,
    });
    const elapsedMs = performance.now() - started;

    expect(result.timedOut).toBeTruthy();
    // Must settle soon after the timeout; hanging until sleep finishes is the bug.
    expect(elapsedMs).toBeLessThan(3000);
  });
});
