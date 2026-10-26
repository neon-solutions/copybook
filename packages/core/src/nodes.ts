import { FRAGMENT } from "./brand";

export type DefinitionKind = "command" | "prompt" | "snippet";

export interface TextNode {
  type: "text";
  value: string;
}

export interface ParamNode {
  name: string;
  /** Set when a secret had no value and rendered as its placeholder. */
  placeholder?: true;
  secret?: true;
  type: "param";
  value: string;
}

export interface CommandNode {
  children: Node[];
  /** The command definition's id, if it came from one. */
  id?: string;
  type: "command";
}

export interface CodeNode {
  children: Node[];
  /** The snippet definition's id, if it came from one. */
  id?: string;
  lang?: string;
  type: "code";
  variant?: string;
}

export interface IncludeNode {
  children: Node[];
  id: string;
  kind: DefinitionKind;
  type: "include";
}

/** A node in a rendered tree. Every node is plain, serializable data. */
export type Node = CodeNode | CommandNode | IncludeNode | ParamNode | TextNode;

/**
 * The result of rendering a definition. It's plain JSON, so a server can
 * render and pass it to a client component.
 */
export interface Rendered {
  id: string;
  kind: DefinitionKind;
  /** The snippet variant's language. */
  lang?: string;
  nodes: Node[];
  /** The snippet variant's key, such as `framework=python`. */
  variant?: string;
}

/** What a `t` template returns. */
export interface Fragment {
  readonly [FRAGMENT]: true;
  readonly nodes: Node[];
}

export const isFragment = (value: unknown): value is Fragment =>
  typeof value === "object" && value !== null && FRAGMENT in value;

export const fragment = (nodes: Node[]): Fragment => ({
  [FRAGMENT]: true,
  nodes,
});
