/**
 * Brands attached to definitions, collections, and template fragments so
 * tooling can recognize them among a module's exports. `Symbol.for` keeps
 * them stable across duplicate copies of this package.
 */
export const DEFINITION = Symbol.for("copybook.def");
export const COLLECTION = Symbol.for("copybook.collection");
export const FRAGMENT = Symbol.for("copybook.fragment");
