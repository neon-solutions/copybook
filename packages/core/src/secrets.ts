import type { Node } from "./nodes";

/** The values of secret params in a tree that rendered a real value. */
export const treeSecrets = (
  nodes: readonly Node[],
  found = new Set<string>()
): Set<string> => {
  for (const node of nodes) {
    if (node.type === "param") {
      const isRealSecret =
        node.secret && !node.placeholder && !node.holdsSecret;
      if (isRealSecret && node.value !== "") {
        found.add(node.value);
      }
    } else if (node.type !== "text") {
      treeSecrets(node.children, found);
    }
  }
  return found;
};

const holdsAny = (text: string, secrets: readonly string[]) =>
  secrets.some((secret) => text.includes(secret));

/**
 * Marks every node whose text holds one of `secrets`, so a UI can keep the
 * secret out of URLs. It never removes a mark: after a fill, text keeps the
 * value it rendered with, so a secret it held may be one the tree no longer
 * shows. A filled param drops its own marks before this runs.
 */
export const markSecrets = (
  nodes: readonly Node[],
  secrets: readonly string[]
): Node[] =>
  nodes.map((node): Node => {
    if (node.type === "text") {
      return node.secret || !holdsAny(node.value, secrets)
        ? node
        : { secret: true, type: "text", value: node.value };
    }
    if (node.type !== "param") {
      return { ...node, children: markSecrets(node.children, secrets) };
    }
    const marked = node.secret || !holdsAny(node.value, secrets);
    return marked ? node : { ...node, holdsSecret: true, secret: true };
  });
