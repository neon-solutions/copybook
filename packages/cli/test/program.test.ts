import { describe, expect, it } from "vitest";

import { BIN_NAME } from "../src/meta";
import { createProgram } from "../src/program";

describe(createProgram, () => {
  it("uses the bin name", () => {
    expect(createProgram().name()).toBe(BIN_NAME);
  });
});
