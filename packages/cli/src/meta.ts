/** The executable name. Rename here, and in package.json `bin`. */
export const BIN_NAME = "prompt-manager";

declare const __PM_VERSION__: string | undefined;

export const VERSION =
  typeof __PM_VERSION__ === "string" ? __PM_VERSION__ : "0.0.0-dev";
