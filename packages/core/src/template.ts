import { dedentStrings } from "./dedent";
import { fragment, isFragment } from "./nodes";
import type {
  CodeNode,
  DefinitionKind,
  Fragment,
  Node,
  ParamNode,
} from "./nodes";
import type { Interpolation, Template } from "./types";

interface Embedded {
  id: string;
  kind: DefinitionKind;
  lang?: string;
  nodes: Node[];
  variant?: string;
}

/** Supplied by `render` for each template call. */
export interface TemplateContext {
  /** Renders an embedded definition with the current render mode. */
  embed: (definition: unknown, values: unknown, variant?: unknown) => Embedded;
  /** Param values that get highlighted when interpolated directly. */
  params: ReadonlyMap<string, Omit<ParamNode, "type" | "value">>;
}

const toNodes = (value: Interpolation, context: TemplateContext): Node[] => {
  if (value === null || value === undefined || typeof value === "boolean") {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item: Interpolation) => toNodes(item, context));
  }
  if (isFragment(value)) {
    return value.nodes;
  }
  const text = String(value);
  const param = text === "" ? undefined : context.params.get(text);
  if (param) {
    return [{ ...param, type: "param", value: text }];
  }
  return [{ type: "text", value: text }];
};

/** Merges adjacent text nodes and drops empty ones. */
export const normalize = (nodes: Node[]): Node[] => {
  const result: Node[] = [];
  for (const node of nodes) {
    if (node.type !== "text") {
      result.push(node);
      continue;
    }
    if (node.value === "") {
      continue;
    }
    const previous = result.at(-1);
    if (previous?.type === "text") {
      result[result.length - 1] = {
        type: "text",
        value: previous.value + node.value,
      };
    } else {
      result.push(node);
    }
  }
  return result;
};

const withVariant = (node: CodeNode, embedded: Embedded): CodeNode => {
  if (embedded.lang !== undefined) {
    node.lang = embedded.lang;
  }
  if (embedded.variant !== undefined) {
    node.variant = embedded.variant;
  }
  return node;
};

export const createTemplate = (context: TemplateContext): Template => {
  const content = (value: Fragment | string | undefined) =>
    normalize(toNodes(value, context));

  const tag = (
    strings: TemplateStringsArray,
    ...values: Interpolation[]
  ): Fragment => {
    const statics = dedentStrings(strings);
    const nodes: Node[] = [];
    for (const [index, value] of statics.entries()) {
      nodes.push({ type: "text", value });
      if (index < values.length) {
        nodes.push(...toNodes(values[index], context));
      }
    }
    return fragment(normalize(nodes));
  };

  const cmd = (command: unknown, values?: unknown): Fragment => {
    if (typeof command === "string" || isFragment(command)) {
      return fragment([{ children: content(command), type: "command" }]);
    }
    const embedded = context.embed(command, values);
    return fragment([
      { children: embedded.nodes, id: embedded.id, type: "command" },
    ]);
  };

  const code = (
    langOrSnippet: unknown,
    contentOrValues?: unknown,
    options?: { variant?: unknown }
  ): Fragment => {
    if (typeof langOrSnippet === "string") {
      const body =
        typeof contentOrValues === "string" || isFragment(contentOrValues)
          ? contentOrValues
          : undefined;
      return fragment([
        { children: content(body), lang: langOrSnippet, type: "code" },
      ]);
    }
    const embedded = context.embed(
      langOrSnippet,
      contentOrValues,
      options?.variant
    );
    return fragment([
      withVariant(
        { children: embedded.nodes, id: embedded.id, type: "code" },
        embedded
      ),
    ]);
  };

  const include = (definition: unknown, values?: unknown): Fragment => {
    const embedded = context.embed(definition, values);
    return fragment([
      {
        children: embedded.nodes,
        id: embedded.id,
        kind: embedded.kind,
        type: "include",
      },
    ]);
  };

  return Object.assign(tag, { cmd, code, include }) as Template;
};
