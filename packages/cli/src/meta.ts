/** The executable name. Rename here, and in package.json `bin`. */
export const BIN_NAME = "copybook";

declare const __COPYBOOK_VERSION__: string | undefined;

export const VERSION =
  typeof __COPYBOOK_VERSION__ === "string" ? __COPYBOOK_VERSION__ : "0.0.0-dev";
