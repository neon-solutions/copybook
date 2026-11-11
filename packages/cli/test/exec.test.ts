import os from "node:os";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, it } from "vitest";

import { exec, killLiveChildren } from "../src/test/exec";

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

  it("reaps background grandchildren after a normal shell exit", async () => {
    const started = performance.now();
    const result = await exec("bash", ["-c", "sleep 30 & echo $!; exit 0"], {
      cwd: os.tmpdir(),
      timeoutMs: 2000,
    });
    const elapsedMs = performance.now() - started;
    const backgroundPid = Math.trunc(Number(result.stdout.trim()));

    expect(result).toMatchObject({ code: 0, timedOut: false });
    expect(elapsedMs).toBeLessThan(1500);
    expect(backgroundPid).toBeGreaterThan(0);
    expect(() => process.kill(backgroundPid, 0)).toThrow(
      /ESRCH|No such process/u
    );
  });

  it("killLiveChildren terminates a tracked detached child group", async () => {
    if (process.platform === "win32") {
      return;
    }

    const resultPromise = exec("bash", ["-c", "sleep 30"], {
      cwd: os.tmpdir(),
      timeoutMs: 10_000,
    });

    // Give spawn a moment to register the live child.
    await delay(100);
    killLiveChildren();

    const result = await resultPromise;
    expect(result.timedOut).toBeFalsy();
    expect(result.code === null || result.code !== 0).toBeTruthy();
  });
});
