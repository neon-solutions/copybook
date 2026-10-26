/**
 * Brand attached to every definition so tooling can find definitions among a
 * module's exports. `Symbol.for` keeps the brand stable across duplicate
 * copies of this package.
 */
export const DEFINITION = Symbol.for("prompt-manager.def");
