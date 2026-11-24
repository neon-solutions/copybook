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
  /**
   * Renders an embedded definition with the current render mode. Absent in
   * the labelling run, where an embed renders nothing: its labels are its own.
   */
  embed?: (definition: unknown, values: unknown, variant?: unknown) => Embedded;
  /**
   * Called once for every interpolated string, number, null, or undefined,
   * in evaluation order, with `undefined` for a value that renders nothing.
   * Returns the param the value came from, or nothing for plain text.
   */
  label: (
    text: string | undefined
  ) => Omit<ParamNode, "type" | "value"> | undefined;
}

const toNodes = (value: Interpolation, context: TemplateContext): Node[] => {
  if (typeof value === "boolean") {
    return [];
  }
  if (value === null || value === undefined) {
    // An omitted optional param still gets a node, so readers can fill it.
    const param = context.label(undefined);
    return param ? [{ ...param, type: "param", value: "" }] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item: Interpolation) => toNodes(item, context));
  }
  if (isFragment(value)) {
    return value.nodes;
  }
  const text = String(value);
  const param = context.label(text);
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
    const embedded = context.embed?.(command, values);
    if (!embedded) {
      return fragment([]);
    }
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
    const embedded = context.embed?.(
      langOrSnippet,
      contentOrValues,
      options?.variant
    );
    if (!embedded) {
      return fragment([]);
    }
    return fragment([
      withVariant(
        { children: embedded.nodes, id: embedded.id, type: "code" },
        embedded
      ),
    ]);
  };

  const include = (definition: unknown, values?: unknown): Fragment => {
    const embedded = context.embed?.(definition, values);
    if (!embedded) {
      return fragment([]);
    }
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
