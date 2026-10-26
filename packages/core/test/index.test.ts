import { describe, expect, it } from "vitest";

import { DEFINITION } from "../src/index";

describe("definition brand", () => {
  it("is a registered global symbol", () => {
    expect(DEFINITION).toBe(Symbol.for("prompt-manager.def"));
  });
});
