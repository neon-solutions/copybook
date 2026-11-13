import type { Node, ParamNode, Rendered } from "./nodes";

export type ParamInfo = Omit<ParamNode, "type">;

const visitParams = (
  nodes: readonly Node[],
  visit: (node: ParamNode) => void
) => {
  for (const node of nodes) {
    if (node.type === "param") {
      visit(node);
    } else if (node.type !== "text") {
      visitParams(node.children, visit);
    }
  }
};

/**
 * Every param in a rendered tree, once per name, in the order they first
 * appear, with the value each first renders as.
 */
export const listParams = (rendered: Rendered): ParamInfo[] => {
  const params = new Map<string, ParamInfo>();
  visitParams(rendered.nodes, ({ type: _type, ...param }) => {
    if (!params.has(param.name)) {
      params.set(param.name, param);
    }
  });
  return [...params.values()];
};

const fillNodes = (
  nodes: readonly Node[],
  values: Readonly<Record<string, string>>
): Node[] =>
  nodes.map((node) => {
    if (node.type === "text") {
      return node;
    }
    if (node.type !== "param") {
      return { ...node, children: fillNodes(node.children, values) };
    }
    const value = values[node.name];
    if (value === undefined || value === "") {
      return node;
    }
    const { placeholder: _placeholder, ...param } = node;
    return { ...param, value };
  });

/**
 * Replaces the value of every param named in `values`, in embedded
 * definitions too. A secret given a value is no longer a placeholder. Empty
 * values are ignored. Only params interpolated directly are param nodes, so
 * text derived from a param keeps the value it was rendered with.
 */
export const fillParams = (
  rendered: Rendered,
  values: Readonly<Record<string, string>>
): Rendered => ({ ...rendered, nodes: fillNodes(rendered.nodes, values) });
