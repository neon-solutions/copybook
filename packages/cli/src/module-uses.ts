import { Visitor } from "oxc-parser";
import type { Argument, BindingPattern, Expression, Program } from "oxc-parser";

/** Imports every export of a module. */
export const NAMESPACE = "*";

/** What a file takes from a module through `require()` or `import()`. */
export interface ModuleUse {
  /** Export names, or {@link NAMESPACE} for all of them. */
  names: string[];
  request: string;
}

const stringLiteral = (node: Argument | Expression | null | undefined) =>
  node?.type === "Literal" && typeof node.value === "string"
    ? node.value
    : undefined;

/** The module a `require("x")` call loads, if `node` is one. */
const requireRequest = (node: Expression | null | undefined) => {
  const isRequire =
    node?.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "require" &&
    node.arguments.length === 1;
  return isRequire ? stringLiteral(node.arguments[0]) : undefined;
};

/** Names a destructuring pattern takes, or the namespace for anything else. */
const patternNames = (pattern: BindingPattern): string[] => {
  if (pattern.type !== "ObjectPattern") {
    return [NAMESPACE];
  }
  const names: string[] = [];
  for (const property of pattern.properties) {
    if (
      property.type !== "Property" ||
      property.computed ||
      property.key.type !== "Identifier"
    ) {
      return [NAMESPACE];
    }
    names.push(property.key.name);
  }
  return names;
};

/**
 * The CommonJS `require("x")` calls and dynamic `import("x")` expressions in
 * a parsed file. `const { a } = require("x")` and `require("x").a` take `a`.
 * Anything else takes the whole module.
 */
export const moduleUses = (program: Program): ModuleUse[] => {
  const uses: ModuleUse[] = [];
  // Calls already counted through their declaration or member access.
  const counted = new Set<Expression>();

  new Visitor({
    CallExpression: (node) => {
      const request = requireRequest(node);
      if (request !== undefined && !counted.has(node)) {
        uses.push({ names: [NAMESPACE], request });
      }
    },
    ImportExpression: (node) => {
      const request = stringLiteral(node.source);
      if (request !== undefined) {
        uses.push({ names: [NAMESPACE], request });
      }
    },
    MemberExpression: (node) => {
      const request = requireRequest(node.object);
      if (request === undefined) {
        return;
      }
      counted.add(node.object);
      const { property } = node;
      const name =
        !node.computed && property.type === "Identifier"
          ? property.name
          : NAMESPACE;
      uses.push({ names: [name], request });
    },
    VariableDeclarator: (node) => {
      const request = requireRequest(node.init);
      if (request === undefined || !node.init) {
        return;
      }
      counted.add(node.init);
      uses.push({ names: patternNames(node.id), request });
    },
  }).visit(program);

  return uses;
};
