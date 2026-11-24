/**
 * This oracle owns the promise that a rendered tree labels a param where,
 * and only where, a template reads it, and marks every real secret, checked
 * on what `toSegments`, `listParams`, and `fillParams` return for trees from
 * `render` and `renderExample`. It owns `src/render.ts#render`,
 * `src/render.ts#renderExample`, `src/template.ts`, `src/fill.ts`, and
 * `src/secrets.ts`.
 *
 * ```ts
 * render(d, { region: "us-east-1", replica: "us-east-1" }) // → param nodes region, then replica
 * t`git diff ${"main"}` // → plain text, when a branch param is "main"
 * t`--prefix ${prefix}` // → an empty prefix node, when prefix is "" or omitted
 * t`${framework === "next" ? t`${region}` : ""}` // → region labelled only when no other param shares its value
 * t.cmd(`curl -H "Bearer ${token}"`) // → text marked secret, so the agent links drop
 * fillParams(render(d, v), w) // → the labels and text of render(d, { ...v, ...w })
 * ```
 *
 * A template receives plain strings and numbers, so `t` sees the same
 * `"admin"` for `${user}` and for `${password}`. Matching interpolated text
 * against param values cannot tell them apart, nor tell `${branch}` from a
 * `${"main"}` that happens to equal it. The Agent Prompt trusts the result:
 * its real-secret guard reads `secret` on every segment, its inputs come
 * from `listParams`, and filling rewrites every node with the filled name.
 *
 * Three parts decide the result. The read is a template expression that is
 * a param's own value (`${v.name}`, or the content of `t.code` or `t.cmd`),
 * with no transform; an embedded definition's reads are its own. The shape
 * says whether the template interpolates the same way when every param
 * prints as a fresh value that equals nothing else (a number keeps its
 * arithmetic); one that branches on a value or rejects it does not. The
 * real secrets are the values of secret params that did not fall back to
 * their placeholder.
 *
 * Laws. Own name: in a template whose shape does not depend on values,
 * every read of a value that is not a boolean renders as one param node
 * with that param's name, empty for `""` or an omitted optional param, with
 * `placeholder` for an unset secret and `secret` for a secret param or a
 * value that holds a real secret (`concepts/params.mdx`, Highlighting and
 * Secrets; decision below); a boolean renders nothing (`render.test.ts`,
 * "skips null, undefined, and booleans"). Nothing else: there, a constant
 * or a value computed from a param is plain text, even when it equals a
 * param's value ("If you transform the value first … it renders as plain
 * text"). Values decide: in a template that branches on or rejects a value,
 * an interpolated value gets a label only when exactly one param has that
 * non-empty value (decision below). Listed once: `listParams` gives each
 * labelled param once, in order of first appearance (`reference/core.mdx`,
 * Filling params). Filling equals rendering: for params that are read and
 * never transformed, `fillParams(render(d, v), w)` gives the labels, list,
 * and text of `render(d, { ...v, ...w })`, embedded definitions too
 * (`components/agent-prompt.mdx`, Editable params). Secret marks: a segment
 * carries `secret` exactly when it is a secret param's or its text holds a
 * real secret; after a fill, text keeps the mark it rendered with, since it
 * keeps its text, and the secrets that count are those the filled tree
 * shows (`agent-prompt.mdx`, Open in an agent). No throw: `render` and
 * `renderExample` return for every definition and accepted values.
 *
 * Decisions by OrcDev (GitHub TheOrcDev), 2026-11-24: labels come from a
 * second, labelling-only run of the template with fresh values; when the
 * runs do not line up, a value is a param only when exactly one param has
 * it; a param that renders `""` or is omitted still gets a node; text that
 * holds a real secret is marked secret, and so is a non-secret param whose
 * value holds one (it also carries `holdsSecret`).
 *
 * The histories build prompts from zero to four params of every kind, each
 * given, defaulted, an example, empty, omitted, or (a secret) unset, with
 * values from a pool small enough that params, constants, placeholders,
 * secrets, and uppercased copies collide. Each frame of the template sits
 * in `⟨…⟩`, so the driver can assign every param node to the expression
 * that produced it. The model predicts each frame's labels and plain text,
 * the lists, and the real secrets from the plan alone; the check compares
 * frame by frame, and applies the secret rule to every observed segment.
 * Every property also bounds the work, so a lost shortcut fails.
 *
 * Limits. `fillParams` runs without the definition, so a typed value equal
 * to a secret the tree never shows stays unmarked. A secret split across
 * two interpolations, such as `${token.slice(0, 4)}${token.slice(4)}`, is
 * not recognized. Snippet variant selection, code-block languages, the ids
 * and kinds of embedded nodes, how text nodes merge, and the errors for a
 * missing param belong to other oracles; here a snippet has one variant.
 */
import { differs, oracleProperty, pass, violation } from "@tanstack/oracles";
import type { Observation, Verdict } from "@tanstack/oracles";
import { array, constantFrom, integer, nat, record } from "fast-check";
import type { Arbitrary } from "fast-check";

import { fillParams, listParams } from "../src/fill";
import {
  defineCommand,
  definePrompt,
  defineSnippet,
  p,
  render,
  renderExample,
  toSegments,
  toText,
} from "../src/index";
import type {
  AnyParam,
  CommandDefinition,
  Fragment,
  Interpolation,
  Node,
  ParamsShape,
  PromptDefinition,
  Rendered,
  SnippetDefinition,
  Template,
} from "../src/index";

// ---------------------------------------------------------------------------
// The history grammar
// ---------------------------------------------------------------------------

/**
 * The value pool. "acme" and "ACME" make an uppercased copy equal another
 * param, "5432" equals the number 5432, and "<token>" equals every secret's
 * placeholder.
 */
const PLACEHOLDER = "<token>";
const POOL = ["acme", "ACME", "main", "5432", PLACEHOLDER] as const;
const NUMBERS = [5432, 7] as const;
/** Values a reader types. "ACME" and "main" collide with the pool. */
const FILLS = ["zed", "ACME", "main"] as const;
/** Every value an enum param may take: the pool and the fills. */
const ENUM_VALUES = [
  "acme",
  "ACME",
  "main",
  "5432",
  PLACEHOLDER,
  "zed",
] as const;
/** The value a branch frame tests for. Fresh values never equal it. */
const BRANCH_VALUE = "acme";
/** What a swap frame interpolates instead of BRANCH_VALUE. */
const SWAPPED = "main";
/** A static snippet's code. */
const STATIC_CODE = "echo static";
/** A threshold frame compares the value as a number with this. */
const THRESHOLD = 1000;
const MAX_PARAMS = 4;
const MAX_PARTS = 6;
const NO_FILL = -1;

const KINDS = ["string", "url", "enum", "number", "boolean", "secret"] as const;
type Kind = (typeof KINDS)[number];
/** Where a param's value comes from. `none` renders a secret's placeholder. */
const SOURCES = [
  "given",
  "example",
  "default",
  "none",
  "empty",
  "omitted",
] as const;
type Source = (typeof SOURCES)[number];
/**
 * What one `⟨…⟩` frame interpolates. Reads: `read`, `code` (the value as a
 * code block's content), `inlineRead` (an inline command around a read),
 * `guard` (the value after the template checks it), and `threshold` (the
 * value when it is a number above THRESHOLD, else a constant). Computed from a value:
 * `derived` (uppercased), `prefixed` (`Bearer …`), `inline` (an inline
 * command built from the value as a string). Embedded definitions that read
 * a param of the same name: `command`, `snippet`, `include`. A `branch`
 * reads the value twice when it is BRANCH_VALUE and once otherwise, so the
 * real run can interpolate more values than a fresh one; `codeText` is a
 * code block whose content is a string built from the value. A `swap`
 * reads the value, unless it is BRANCH_VALUE, when it interpolates the
 * constant "main" instead, so the two runs interpolate as many values but
 * different ones. `static` embeds a snippet whose code is a plain string;
 * `nothing` interpolates `undefined`.
 */
const PARTS = [
  "read",
  "constant",
  "nothing",
  "derived",
  "prefixed",
  "inline",
  "inlineRead",
  "code",
  "codeText",
  "command",
  "snippet",
  "include",
  "branch",
  "swap",
  "guard",
  "threshold",
  "static",
] as const;
type PartKind = (typeof PARTS)[number];
const kinds = (...members: PartKind[]): ReadonlySet<PartKind> =>
  new Set(members);
const EMBEDS = kinds("command", "snippet", "include");
const READS = kinds(
  "read",
  "code",
  "inlineRead",
  "guard",
  "branch",
  "swap",
  "threshold"
);
const COMPUTED = kinds("derived", "prefixed", "inline", "codeText");
/** Frames whose path can depend on a value. */
const VALUE_DEPENDENT = kinds("branch", "swap", "guard", "threshold");

interface HistoryParam {
  kind: Kind;
  source: Source;
  value: number;
}
interface HistoryPart {
  kind: PartKind;
  /** A param index, or a pool index for a constant. */
  ref: number;
}
interface History {
  /** Per param: an index into FILLS, or NO_FILL. */
  fill: number[];
  mode: "example" | "render";
  params: HistoryParam[];
  parts: HistoryPart[];
}

const historyArbitrary: Arbitrary<History> = record({
  fill: array(integer({ max: FILLS.length - 1, min: NO_FILL }), {
    maxLength: MAX_PARAMS,
  }),
  mode: constantFrom("render" as const, "example" as const),
  params: array(
    record({
      kind: constantFrom(...KINDS),
      source: constantFrom(...SOURCES),
      value: nat({ max: POOL.length - 1 }),
    }),
    { maxLength: MAX_PARAMS }
  ),
  parts: array(
    record({
      kind: constantFrom(...PARTS),
      ref: nat({ max: POOL.length - 1 }),
    }),
    { maxLength: MAX_PARTS, minLength: 1 }
  ),
});

// ---------------------------------------------------------------------------
// The plan: legal concrete inputs
// ---------------------------------------------------------------------------

type Value = boolean | number | string | undefined;

interface PlanParam {
  kind: Kind;
  name: string;
  source: Source;
  /** The configured value: undefined when omitted, "" when empty. */
  value: Value;
}
interface PlanPart {
  /** The constant's text, for a constant frame. */
  constant: string;
  kind: PartKind;
  /** The param index, for every other frame. */
  param: number;
}
interface Plan {
  fill: Record<string, string>;
  mode: "example" | "render";
  params: PlanParam[];
  parts: PlanPart[];
}

const nameOf = (index: number) => `p${index}`;

/** Stands in for the param of a constant frame in a prompt with no params. */
const NO_PARAM: PlanParam = {
  kind: "string",
  name: "",
  source: "omitted",
  value: undefined,
};

/** The param a frame reads. `resolve` keeps every index in range. */
const paramAt = (params: readonly PlanParam[], part: PlanPart): PlanParam =>
  params[part.param] ?? NO_PARAM;

/** A secret given its own placeholder counts as unset, so it never draws it. */
const poolValue = (kind: Kind, index: number): boolean | number | string => {
  if (kind === "boolean") {
    return index % 2 === 0;
  }
  if (kind === "number") {
    return NUMBERS[index % NUMBERS.length] ?? NUMBERS[0];
  }
  const value = POOL[index % POOL.length] ?? POOL[0];
  return kind === "secret" && value === PLACEHOLDER ? POOL[0] : value;
};

/**
 * Only a secret may stay unset, and a secret is never omitted (it renders
 * its placeholder instead). Only string-like params may be empty, since ""
 * is no number, boolean, or enum option.
 */
const legalSource = (param: HistoryParam, mode: History["mode"]): Source => {
  const { kind, source } = param;
  if (source === "none" || source === "omitted") {
    if (kind === "secret") {
      return "none";
    }
    return source === "none" ? "given" : "omitted";
  }
  const isTyped = kind === "number" || kind === "enum" || kind === "boolean";
  if (source === "empty" && isTyped) {
    return "given";
  }
  // `render` ignores `.example()`, so render mode passes the value instead.
  return source === "example" && mode === "render" ? "given" : source;
};

const configuredValue = (param: HistoryParam, source: Source): Value => {
  if (source === "omitted") {
    return undefined;
  }
  return source === "empty" ? "" : poolValue(param.kind, param.value);
};

/**
 * The fill law covers params that are read and never transformed, in a
 * template whose shape does not depend on values, so only those get a fill.
 * A number or boolean param gets none: a reader types text.
 */
const legalFill = (
  history: History,
  params: readonly PlanParam[],
  parts: readonly PlanPart[]
) => {
  const fill: Record<string, string> = {};
  if (parts.some((part) => VALUE_DEPENDENT.has(part.kind))) {
    return fill;
  }
  for (const [index, choice] of history.fill.entries()) {
    const param = params[index];
    const value = FILLS[choice];
    const frames = parts.filter(
      (part) => part.param === index && part.kind !== "constant"
    );
    const isRead = frames.some(
      (part) => READS.has(part.kind) || EMBEDS.has(part.kind)
    );
    const isComputed = frames.some((part) => COMPUTED.has(part.kind));
    const isText = param?.kind !== "number" && param?.kind !== "boolean";
    if (param && value !== undefined && isText && isRead && !isComputed) {
      fill[param.name] = value;
    }
  }
  return fill;
};

/** Legality lives here, so every shrunk history stays legal. */
const resolve = (history: History): Plan => {
  const params = history.params.map((param, index): PlanParam => {
    const source = legalSource(param, history.mode);
    return {
      kind: param.kind,
      name: nameOf(index),
      source,
      value: configuredValue(param, source),
    };
  });
  // With no params, every frame but `nothing` interpolates a constant.
  const parts = history.parts.map((part): PlanPart => ({
    constant: POOL[part.ref % POOL.length] ?? POOL[0],
    kind: params.length > 0 || part.kind === "nothing" ? part.kind : "constant",
    param: params.length > 0 ? part.ref % params.length : 0,
  }));
  return {
    fill: legalFill(history, params, parts),
    mode: history.mode,
    params,
    parts,
  };
};

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

/** A param node as a UI reads it. */
interface Label {
  holdsSecret?: true;
  name: string;
  placeholder?: true;
  secret?: true;
  text: string;
}
type Listed = Omit<Label, "text"> & { value: string };
interface Rendering {
  /** The labels inside each `⟨…⟩` frame, in frame order. */
  labels: Label[][];
  /** The copied text, in plain format. */
  text: string;
}
interface Expected extends Rendering {
  filled: Rendering;
  filledListed: Listed[];
  /** The params a fill replaced. */
  filledNames: string[];
  /**
   * Real secrets of the filled values that the filled tree shows: fillParams
   * runs without the definition, so it sees only secret params that are read.
   */
  filledSecrets: string[];
  listed: Listed[];
  /** The names of secret params. */
  secretNames: string[];
  /** Real secrets of the rendered values. */
  secrets: string[];
}

/** The value the template receives: a secret's placeholder when unset. */
const received = (param: PlanParam): Value =>
  param.source === "none" ? PLACEHOLDER : param.value;

/** A param that renders a node when read: anything but a boolean. */
const hasNode = (param: PlanParam) => typeof received(param) !== "boolean";

/** What a read renders: nothing for an omitted value or a boolean. */
const shown = (param: PlanParam) => {
  const value = received(param);
  return value === undefined || typeof value === "boolean" ? "" : String(value);
};

/** Secret params that rendered a real value, not their placeholder. */
const realSecrets = (params: readonly PlanParam[]) =>
  params
    .filter((param) => param.kind === "secret" && param.source !== "none")
    .map(shown)
    .filter((value) => value !== "");

const holdsAny = (text: string, secrets: readonly string[]) =>
  secrets.some((secret) => text.includes(secret));

/**
 * Own name: the reading param's name, `placeholder` for an unset secret,
 * `secret` for a secret param, and `secret` with `holdsSecret` for any other
 * param whose value holds a real secret (params.mdx, Secrets; decision). A
 * boolean renders no node.
 */
const labelsOf = (param: PlanParam, secrets: readonly string[]): Label[] => {
  if (!hasNode(param)) {
    return [];
  }
  const base = { name: param.name, text: shown(param) };
  if (param.kind === "secret") {
    return param.source === "none"
      ? [{ ...base, placeholder: true, secret: true }]
      : [{ ...base, secret: true }];
  }
  return holdsAny(base.text, secrets)
    ? [{ ...base, holdsSecret: true, secret: true }]
    : [base];
};

const isAbove = (value: Value) => Number(value) > THRESHOLD;

/**
 * The shape. Every param but a boolean gets a fresh value in the labelling
 * run. A fresh value never equals BRANCH_VALUE, never passes a guard,
 * and, unless it is a number, is no number above THRESHOLD. So a template
 * depends on values when a branch's value is BRANCH_VALUE, any frame guards
 * a value, or a threshold frame compares a non-number above it.
 */
const dependsOnValues = (plan: Plan, params: readonly PlanParam[]) =>
  plan.parts.some((part) => {
    const param = paramAt(params, part);
    switch (part.kind) {
      case "guard": {
        // A boolean gets no fresh value, so its guard passes in both runs.
        return hasNode(param);
      }
      case "branch":
      case "swap": {
        return received(param) === BRANCH_VALUE;
      }
      case "threshold": {
        return param.kind !== "number" && isAbove(received(param));
      }
      default: {
        return false;
      }
    }
  });

/**
 * Values decide: in a template that depends on values, a non-empty value is
 * labelled when exactly one param has it (decision 1b).
 */
const byValue = (
  text: string | undefined,
  params: readonly PlanParam[],
  secrets: readonly string[]
): Label[] => {
  if (text === undefined || text === "") {
    return [];
  }
  const owners = params.filter(
    (param) =>
      received(param) !== undefined && hasNode(param) && shown(param) === text
  );
  const [owner] = owners;
  return owners.length === 1 && owner ? labelsOf(owner, secrets) : [];
};

/** The text a frame's expression computes, as JavaScript computes it. */
const frameText = (part: PlanPart, param: PlanParam): string => {
  const value = received(param);
  switch (part.kind) {
    case "constant": {
      return part.constant;
    }
    case "nothing": {
      return "";
    }
    case "derived": {
      return String(value).toUpperCase();
    }
    case "prefixed": {
      return `Bearer ${String(value)}`;
    }
    case "inline":
    case "codeText": {
      return `run ${String(value)}`;
    }
    case "inlineRead":
    case "command": {
      return `run ${shown(param)}`;
    }
    case "snippet": {
      return `echo ${shown(param)}`;
    }
    case "include": {
      return `see ${shown(param)}`;
    }
    case "branch": {
      return value === BRANCH_VALUE
        ? `yes ${shown(param)} ${shown(param)}`
        : `no ${shown(param)}`;
    }
    case "threshold": {
      return isAbove(value) ? `big ${shown(param)}` : "small";
    }
    case "swap": {
      return value === BRANCH_VALUE ? SWAPPED : shown(param);
    }
    case "static": {
      return STATIC_CODE;
    }
    default: {
      return shown(param);
    }
  }
};

/** The values a frame hands to `t`, in order, for the values-decide law. */
const frameLeaves = (
  part: PlanPart,
  param: PlanParam
): (string | undefined)[] => {
  const value = received(param);
  const read =
    value === undefined || typeof value === "boolean"
      ? undefined
      : String(value);
  if (part.kind === "branch") {
    return value === BRANCH_VALUE ? [read, read] : [read];
  }
  if (part.kind === "threshold") {
    return isAbove(value) ? [read] : ["small"];
  }
  if (part.kind === "swap") {
    return value === BRANCH_VALUE ? [SWAPPED] : [read];
  }
  if (part.kind === "nothing") {
    return [undefined];
  }
  return READS.has(part.kind) ? [read] : [frameText(part, param)];
};

interface FrameContext {
  depends: boolean;
  params: readonly PlanParam[];
  secrets: readonly string[];
}

/** The model of one frame's labels. */
const frameLabels = (
  part: PlanPart,
  param: PlanParam,
  { depends, params, secrets }: FrameContext
): Label[] => {
  // An embedded definition's template is its own, and reads its param.
  if (EMBEDS.has(part.kind)) {
    return labelsOf(param, secrets);
  }
  if (part.kind === "static") {
    return [];
  }
  if (depends) {
    return frameLeaves(part, param).flatMap((leaf) =>
      byValue(leaf, params, secrets)
    );
  }
  if (part.kind === "branch") {
    return received(param) === BRANCH_VALUE
      ? [...labelsOf(param, secrets), ...labelsOf(param, secrets)]
      : labelsOf(param, secrets);
  }
  if (part.kind === "threshold") {
    return isAbove(received(param)) ? labelsOf(param, secrets) : [];
  }
  if (part.kind === "swap") {
    return received(param) === BRANCH_VALUE ? [] : labelsOf(param, secrets);
  }
  return READS.has(part.kind) ? labelsOf(param, secrets) : [];
};

const renderingOf = (plan: Plan, params: readonly PlanParam[]): Rendering => {
  const context: FrameContext = {
    depends: dependsOnValues(plan, params),
    params,
    secrets: realSecrets(params),
  };
  const frames = plan.parts.map((part) => {
    const param = paramAt(params, part);
    return {
      labels: frameLabels(part, param, context),
      text: frameText(part, param),
    };
  });
  return {
    labels: frames.map((frame) => frame.labels),
    text: frames.map((frame) => `⟨${frame.text}⟩`).join(""),
  };
};

/**
 * Filling equals rendering: a filled param renders as if given the typed
 * value, so a filled secret is real (reference/core.mdx, Filling params).
 */
const filledParams = (plan: Plan) =>
  plan.params.map((param): PlanParam => {
    const value = plan.fill[param.name];
    return value === undefined ? param : { ...param, source: "given", value };
  });

/** Listed once: the first label of each name, in frame order. */
const listedOf = (rendering: Rendering): Listed[] => {
  const listed = new Map<string, Listed>();
  for (const label of rendering.labels.flat()) {
    if (!listed.has(label.name)) {
      const { text, ...flags } = label;
      listed.set(label.name, { ...flags, value: text });
    }
  }
  return [...listed.values()];
};

/** The params a read frame or an embedded definition reads. */
const readNames = (plan: Plan) =>
  new Set(
    plan.parts
      .filter((part) => READS.has(part.kind) || EMBEDS.has(part.kind))
      .filter((part) => {
        const value = received(paramAt(plan.params, part));
        if (part.kind === "swap") {
          return value !== BRANCH_VALUE;
        }
        return part.kind !== "threshold" || isAbove(value);
      })
      .map((part) => paramAt(plan.params, part).name)
  );

const model = (plan: Plan): Expected => {
  const rendering = renderingOf(plan, plan.params);
  const filled = filledParams(plan);
  const filledRendering = renderingOf(plan, filled);
  const read = readNames(plan);
  return {
    ...rendering,
    filled: filledRendering,
    filledListed: listedOf(filledRendering),
    filledNames: Object.keys(plan.fill),
    filledSecrets: realSecrets(filled.filter((param) => read.has(param.name))),
    listed: listedOf(rendering),
    secretNames: plan.params
      .filter((param) => param.kind === "secret")
      .map((param) => param.name),
    secrets: realSecrets(plan.params),
  };
};

// ---------------------------------------------------------------------------
// The driver
// ---------------------------------------------------------------------------

const builderOf = (kind: Kind): AnyParam => {
  switch (kind) {
    case "string": {
      return p.string();
    }
    case "url": {
      return p.url();
    }
    case "enum": {
      return p.enum(ENUM_VALUES);
    }
    case "number": {
      return p.number();
    }
    case "boolean": {
      return p.boolean();
    }
    default: {
      return p.secret({ placeholder: PLACEHOLDER });
    }
  }
};

/** An embedded definition's param: the same kind, optional for any value. */
const embeddedParam = (kind: Kind): AnyParam =>
  kind === "secret" ? builderOf(kind) : builderOf(kind).optional();

const paramOf = (param: PlanParam): AnyParam => {
  const builder = builderOf(param.kind);
  switch (param.source) {
    case "example": {
      return builder.example(param.value);
    }
    case "default": {
      return builder.default(param.value);
    }
    case "omitted": {
      return builder.optional();
    }
    default: {
      return builder;
    }
  }
};

/** A template that validates its values, as an author might. */
const validated = (value: unknown): unknown => {
  const valid =
    value === undefined ||
    value === "" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isInteger(value)) ||
    ENUM_VALUES.some((option) => option === value);
  if (!valid) {
    throw new Error(`invalid value ${String(value)}`);
  }
  return value;
};

/** A snippet whose code is a plain string, with no params. */
const STATIC_SNIPPET = defineSnippet({
  code: STATIC_CODE,
  id: "oracle.labels.static",
  lang: "sh",
});

interface Embeds {
  commands: CommandDefinition<ParamsShape>[];
  includes: PromptDefinition<ParamsShape>[];
  snippets: SnippetDefinition<ParamsShape>[];
}

/** The frames whose path depends on the value, as an author writes them. */
const valueDependent = (
  t: Template,
  value: Interpolation,
  kind: PartKind
): Interpolation => {
  switch (kind) {
    case "branch": {
      return value === BRANCH_VALUE ? t`yes ${value} ${value}` : t`no ${value}`;
    }
    case "swap": {
      return value === BRANCH_VALUE ? t`${SWAPPED}` : t`${value}`;
    }
    default: {
      return Number(value) > THRESHOLD ? t`big ${value}` : "small";
    }
  }
};

/** Each frame's interpolation, written the way a template author writes it. */
const interpolationOf = (
  t: Template,
  values: Readonly<Record<string, unknown>>,
  part: PlanPart,
  embeds: Embeds
): Interpolation => {
  const name = nameOf(part.param);
  const value = values[name] as Interpolation;
  const own = { [name]: value };
  switch (part.kind) {
    case "read": {
      return value;
    }
    case "constant": {
      return part.constant;
    }
    case "nothing": {
      return undefined;
    }
    case "derived": {
      return String(value).toUpperCase();
    }
    case "prefixed": {
      return `Bearer ${String(value)}`;
    }
    case "inline": {
      return t.cmd(`run ${String(value)}`);
    }
    case "inlineRead": {
      return t.cmd(t`run ${value}`);
    }
    case "codeText": {
      return t.code("sh", `run ${String(value)}`);
    }
    case "code": {
      return t.code("sh", t`${value}`);
    }
    case "command": {
      const command = embeds.commands[part.param];
      return command ? t.cmd(command, own) : "";
    }
    case "snippet": {
      const snippet = embeds.snippets[part.param];
      return snippet ? t.code(snippet, own) : "";
    }
    case "include": {
      const include = embeds.includes[part.param];
      return include ? t.include(include, own) : "";
    }
    case "static": {
      return t.code(STATIC_SNIPPET);
    }
    case "guard": {
      return validated(value) as Interpolation;
    }
    default: {
      return valueDependent(t, value, part.kind);
    }
  }
};

const readParam =
  (name: string) => (values: Readonly<Record<string, unknown>>) =>
    values[name] as Interpolation;

const embedsOf = (plan: Plan): Embeds => {
  const shapes = plan.params.map((param) => ({
    [param.name]: embeddedParam(param.kind),
  }));
  return {
    commands: plan.params.map((param, index) =>
      defineCommand<ParamsShape>({
        id: `oracle.labels.command.${param.name}`,
        params: shapes[index] ?? {},
        template: (t, values) => t`run ${readParam(param.name)(values)}`,
      })
    ),
    includes: plan.params.map((param, index) =>
      definePrompt<ParamsShape>({
        id: `oracle.labels.include.${param.name}`,
        params: shapes[index] ?? {},
        template: (t, values) => t`see ${readParam(param.name)(values)}`,
      })
    ),
    snippets: plan.params.map((param, index) =>
      defineSnippet<ParamsShape>({
        id: `oracle.labels.snippet.${param.name}`,
        lang: "sh",
        params: shapes[index] ?? {},
        template: (t, values) => t`echo ${readParam(param.name)(values)}`,
      })
    ),
  };
};

const definitionOf = (plan: Plan) => {
  const shape: Record<string, AnyParam> = {};
  for (const param of plan.params) {
    shape[param.name] = paramOf(param);
  }
  const embeds = embedsOf(plan);
  return definePrompt<ParamsShape>({
    id: "oracle.labels",
    params: shape,
    template: (t, values): Fragment =>
      t`${plan.parts.map(
        (part) =>
          t`⟨${interpolationOf(t, values as Record<string, unknown>, part, embeds)}⟩`
      )}`,
  });
};

const givenValues = (plan: Plan) => {
  const values: Record<string, unknown> = {};
  for (const param of plan.params) {
    if (param.source === "given" || param.source === "empty") {
      values[param.name] = param.value;
    }
  }
  return values;
};

/** With no value given, the driver passes none, as a caller would. */
const renderPlan = (plan: Plan) => {
  const definition = definitionOf(plan);
  const values = givenValues(plan);
  const hasValues = Object.keys(values).length > 0;
  if (plan.mode === "render") {
    return hasValues ? render(definition, values) : render(definition);
  }
  return hasValues
    ? renderExample(definition, { values })
    : renderExample(definition);
};

const FRAME_OPEN = "⟨";

/**
 * Assigns each param node to the frame it sits in, walking the tree in
 * order. Pool values never hold `⟨`, so each one in a text node opens the
 * next frame.
 */
const framesOf = (
  nodes: readonly Node[],
  frames: Label[][] = []
): Label[][] => {
  for (const node of nodes) {
    if (node.type === "param") {
      frames.at(-1)?.push({
        name: node.name,
        text: node.value,
        ...(node.secret ? { secret: true as const } : {}),
        ...(node.placeholder ? { placeholder: true as const } : {}),
        ...(node.holdsSecret ? { holdsSecret: true as const } : {}),
      });
    } else if (node.type === "text") {
      for (const char of node.value) {
        if (char === FRAME_OPEN) {
          frames.push([]);
        }
      }
    } else {
      framesOf(node.children, frames);
    }
  }
  return frames;
};

/** A segment as the real-secret guard reads it. */
interface SegmentView {
  name?: string;
  secret?: true;
  text: string;
  type: string;
}

const segmentsOf = (rendered: Rendered): SegmentView[] =>
  toSegments(rendered).map((segment) => ({
    text: segment.text,
    type: segment.type,
    ...(segment.name === undefined ? {} : { name: segment.name }),
    ...(segment.secret ? { secret: true as const } : {}),
  }));

const viewOf = (rendered: Rendered) => ({
  labels: framesOf(rendered.nodes),
  segments: segmentsOf(rendered),
  text: toText(rendered, { format: "plain" }),
});

/**
 * Renders the plan through the real entry points and records what a UI
 * reads: each frame's labels, the segments, the plain text, and the listed
 * params, for the rendered and the filled tree. A throw is recorded, so the
 * check can reject it.
 */
const driver = (
  plan: Plan,
  observe: (checkpoint: string, value: unknown) => void
) => {
  try {
    const rendered = renderPlan(plan);
    observe("rendered", viewOf(rendered));
    observe("listed", listParams(rendered));
    const filled = fillParams(rendered, plan.fill);
    observe("filled", viewOf(filled));
    observe("filledListed", listParams(filled));
  } catch (error) {
    observe("error", error instanceof Error ? error.message : String(error));
  }
};

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

interface View extends Rendering {
  segments: SegmentView[];
}

const valueAt = (observations: readonly Observation[], checkpoint: string) =>
  observations.find((observation) => observation.checkpoint === checkpoint)
    ?.value;

const threw = (observations: readonly Observation[], law: string) => {
  const error = valueAt(observations, "error");
  return error === undefined
    ? undefined
    : violation("error", `render threw: ${String(error)}`, law);
};

const OWN_NAME = "own name";
const NOTHING_ELSE = "nothing else is a param";
const VALUES_DECIDE = "values decide";
const LISTED_ONCE = "each param listed once";
const FILL_EQUALS_RENDER = "filling equals rendering";
const SECRET_MARKS = "secret marks";
const NO_THROW = "no throw on valid input";

/** Compares the frames that `applies` selects, one frame at a time. */
const checkFrames =
  (law: string, applies: (part: PlanPart, depends: boolean) => boolean) =>
  (
    plan: Plan,
    observations: readonly Observation[],
    expected: Expected
  ): Verdict => {
    const failure = threw(observations, law);
    if (failure) {
      return failure;
    }
    const depends = dependsOnValues(plan, plan.params);
    const rendered = valueAt(observations, "rendered") as View | undefined;
    for (const [index, part] of plan.parts.entries()) {
      if (!applies(part, depends)) {
        continue;
      }
      const verdict = differs(
        `rendered frame ${index}`,
        law,
        rendered?.labels[index],
        expected.labels[index],
        `frame ${index} (${part.kind} of ${nameOf(part.param)}) has the wrong labels`
      );
      if (verdict) {
        return verdict;
      }
    }
    return pass;
  };

/**
 * Filling equals rendering compares names, values, and placeholders; the
 * marks a held secret adds are the secret law's. A key the fill sets to
 * undefined stays, so the comparison sees it.
 */
const unmarked = <T extends { holdsSecret?: true; secret?: true }>(
  entry: T
) => {
  const { holdsSecret, ...rest } = entry;
  if (!holdsSecret) {
    return rest;
  }
  const { secret: _secret, ...plain } = rest;
  return plain;
};

const unmarkedFrames = (labels: readonly Label[][] | undefined) =>
  labels?.map((frame) => frame.map(unmarked));

/**
 * Secret marks: a segment is marked exactly when it is a secret param's, or
 * its text holds a real secret. After a fill, text and unfilled params keep
 * the mark they rendered with, so a secret of either value set counts.
 */
const checkSegments = (
  checkpoint: string,
  segments: readonly SegmentView[] | undefined,
  owed: (segment: SegmentView) => boolean
): Verdict | undefined => {
  for (const [index, segment] of (segments ?? []).entries()) {
    const verdict = differs(
      `${checkpoint} segment ${index}`,
      SECRET_MARKS,
      segment.secret === true,
      owed(segment),
      `segment ${index} (${segment.type} "${segment.text}") has the wrong secret mark`
    );
    if (verdict) {
      return verdict;
    }
  }
  return undefined;
};

/** A param segment of one of `names`. */
const isParam = (segment: SegmentView, names: readonly string[]) =>
  segment.type === "param" && names.includes(segment.name ?? "");

const checkSecrets = (
  _plan: Plan,
  observations: readonly Observation[],
  expected: Expected
): Verdict => {
  const failure = threw(observations, SECRET_MARKS);
  if (failure) {
    return failure;
  }
  const rendered = valueAt(observations, "rendered") as View | undefined;
  const filled = valueAt(observations, "filled") as View | undefined;
  return (
    checkSegments(
      "rendered",
      rendered?.segments,
      (segment) =>
        isParam(segment, expected.secretNames) ||
        holdsAny(segment.text, expected.secrets)
    ) ??
    checkSegments(
      "filled",
      filled?.segments,
      (segment) =>
        isParam(segment, expected.secretNames) ||
        holdsAny(segment.text, expected.filledSecrets) ||
        (!isParam(segment, expected.filledNames) &&
          holdsAny(segment.text, expected.secrets))
    ) ??
    pass
  );
};

// ---------------------------------------------------------------------------
// Reach: the states the laws depend on, predicted from the plan
// ---------------------------------------------------------------------------

const SHARED = "two read params share a value";
const SECRET_SHARED = "a secret shares a value with an earlier param";
const PLACEHOLDER_READ = "an unset secret is read";
const SECRET_PRESET = "a secret comes from an example or a default";
const EMPTY_READ = "an empty param is read";
const OMITTED_READ = "an omitted optional param is read";
const BOOLEAN_READ = "a boolean param is read";
const EMBEDDED = "an embedded command reads a param";
const SNIPPET = "an embedded snippet reads a param";
const INCLUDED = "an included prompt reads a param";
const CODE_READ = "a code block's content is a param";
const INLINE_READ = "an inline command reads a param";
const NUMBER_COMPARED = "a number param is compared before it is read";
const HOLDS_SECRET = "a param that is not a secret holds a real secret";
const NO_VALUES = "no value is passed";
const NO_PARAMS = "a prompt has no params";
const NOTHING = "an interpolation renders nothing";
const CONSTANT_EQUAL = "a constant equals a param's value";
const DERIVED_EQUAL = "an uppercased copy equals a param's value";
const INLINE = "an inline command is built from a param";
const DEPENDS_SHARED = "a value-dependent template reads a shared value";
const DEPENDS_UNIQUE = "a value-dependent template reads a unique value";
const FILL_SHARED = "a filled param shares its value";
const FILL_COLLIDES = "a fill equals another read param's value";
const FILL_EMPTY = "an empty or omitted param is filled";
const FILL_SECRET = "a read secret is filled";
const FILL_HOLDS = "a param that holds a real secret is filled";
const FILL_SECRET_EMBEDDED =
  "a secret read only inside an embed is filled with another param's value";
const SECRET_DERIVED = "text is built around a real secret";
const SECRET_UNREAD = "a real secret that is never read appears in text";
const BRANCHES = "a frame branches on a value";
const GUARDS = "a frame validates a value";
const SWAPS = "the real run interpolates a constant where a fresh one reads";
const STATIC = "a snippet with plain code is embedded";

interface Facts {
  depends: boolean;
  plan: Plan;
  /** The params that a read frame or an embedded definition reads. */
  read: PlanParam[];
  secrets: string[];
  /** What every param that renders a node renders. */
  values: ReadonlySet<string>;
}

const sharesWith = (param: PlanParam, others: readonly PlanParam[]) =>
  received(param) !== undefined &&
  hasNode(param) &&
  others.some(
    (other) =>
      other.name !== param.name &&
      received(other) !== undefined &&
      hasNode(other) &&
      shown(other) === shown(param)
  );

const partsOf = (facts: Facts, wanted: ReadonlySet<PartKind>) =>
  facts.plan.parts.filter((candidate) => wanted.has(candidate.kind));

const has = (facts: Facts, kind: PartKind) =>
  partsOf(facts, kinds(kind)).length > 0;

const isFilled = (facts: Facts, param: PlanParam) =>
  facts.plan.fill[param.name] !== undefined;

const textsOf = (facts: Facts) =>
  facts.plan.parts.map((part) =>
    frameText(part, paramAt(facts.plan.params, part))
  );

/** Each state, as a predicate over the plan. */
const REACH: readonly [string, (facts: Facts) => boolean][] = [
  [SHARED, ({ read }) => read.some((param) => sharesWith(param, read))],
  [
    SECRET_SHARED,
    ({ plan, read }) =>
      read.some(
        (param) =>
          param.kind === "secret" &&
          sharesWith(param, plan.params.slice(0, plan.params.indexOf(param)))
      ),
  ],
  [
    PLACEHOLDER_READ,
    ({ read }) =>
      read.some((param) => param.kind === "secret" && param.source === "none"),
  ],
  [
    SECRET_PRESET,
    ({ read }) =>
      read.some(
        (param) =>
          param.kind === "secret" &&
          (param.source === "example" || param.source === "default")
      ),
  ],
  [EMPTY_READ, ({ read }) => read.some((param) => param.source === "empty")],
  [
    OMITTED_READ,
    ({ read }) => read.some((param) => param.source === "omitted"),
  ],
  [
    BOOLEAN_READ,
    ({ read }) => read.some((param) => typeof received(param) === "boolean"),
  ],
  [EMBEDDED, (facts) => has(facts, "command")],
  [SNIPPET, (facts) => has(facts, "snippet")],
  [INCLUDED, (facts) => has(facts, "include")],
  [CODE_READ, (facts) => has(facts, "code")],
  [INLINE_READ, (facts) => has(facts, "inlineRead")],
  [
    NUMBER_COMPARED,
    (facts) =>
      partsOf(facts, kinds("threshold")).some(
        (part) => paramAt(facts.plan.params, part).kind === "number"
      ),
  ],
  [
    HOLDS_SECRET,
    ({ read, secrets }) =>
      read.some(
        (param) => param.kind !== "secret" && holdsAny(shown(param), secrets)
      ),
  ],
  [NO_VALUES, ({ plan }) => Object.keys(givenValues(plan)).length === 0],
  [NO_PARAMS, ({ plan }) => plan.params.length === 0],
  [NOTHING, (facts) => has(facts, "nothing")],
  [
    CONSTANT_EQUAL,
    (facts) =>
      partsOf(facts, kinds("constant")).some((part) =>
        facts.values.has(part.constant)
      ),
  ],
  [
    DERIVED_EQUAL,
    (facts) =>
      partsOf(facts, kinds("derived")).some((part) =>
        facts.values.has(
          String(received(paramAt(facts.plan.params, part))).toUpperCase()
        )
      ),
  ],
  [INLINE, (facts) => has(facts, "inline")],
  [
    DEPENDS_SHARED,
    ({ depends, read }) =>
      depends && read.some((param) => sharesWith(param, read)),
  ],
  [
    DEPENDS_UNIQUE,
    ({ depends, plan, read }) =>
      depends &&
      read.some(
        (param) =>
          hasNode(param) &&
          shown(param) !== "" &&
          !sharesWith(param, plan.params)
      ),
  ],
  [
    FILL_SHARED,
    (facts) =>
      facts.read.some(
        (param) => isFilled(facts, param) && sharesWith(param, facts.read)
      ),
  ],
  [
    FILL_COLLIDES,
    ({ plan, read }) =>
      Object.entries(plan.fill).some(([name, value]) =>
        read.some((other) => other.name !== name && shown(other) === value)
      ),
  ],
  [
    FILL_EMPTY,
    (facts) =>
      facts.read.some((param) => isFilled(facts, param) && shown(param) === ""),
  ],
  [
    FILL_SECRET,
    (facts) =>
      facts.read.some(
        (param) => isFilled(facts, param) && param.kind === "secret"
      ),
  ],
  [
    FILL_HOLDS,
    (facts) =>
      facts.read.some(
        (param) =>
          isFilled(facts, param) &&
          param.kind !== "secret" &&
          holdsAny(shown(param), facts.secrets)
      ),
  ],
  [
    FILL_SECRET_EMBEDDED,
    ({ plan, read }) =>
      read.some(
        (param) =>
          param.kind === "secret" &&
          plan.fill[param.name] !== undefined &&
          !plan.parts.some(
            (part) =>
              READS.has(part.kind) &&
              paramAt(plan.params, part).name === param.name
          ) &&
          read.some((other) => shown(other) === plan.fill[param.name])
      ),
  ],
  [
    SECRET_DERIVED,
    (facts) =>
      partsOf(facts, COMPUTED).some((part) => {
        const param = paramAt(facts.plan.params, part);
        return (
          param.kind === "secret" &&
          holdsAny(frameText(part, param), facts.secrets)
        );
      }),
  ],
  [
    SECRET_UNREAD,
    (facts) =>
      facts.plan.params.some(
        (param) =>
          param.kind === "secret" &&
          !facts.read.includes(param) &&
          textsOf(facts).some((text) => holdsAny(text, realSecrets([param])))
      ),
  ],
  [BRANCHES, (facts) => has(facts, "branch")],
  [GUARDS, (facts) => has(facts, "guard")],
  [
    SWAPS,
    (facts) =>
      partsOf(facts, kinds("swap")).some(
        (part) => received(paramAt(facts.plan.params, part)) === BRANCH_VALUE
      ),
  ],
  [STATIC, (facts) => has(facts, "static")],
];

const ALL_STATES = REACH.map(([state]) => state);

const reachedBy = (plan: Plan): string[] => {
  const names = readNames(plan);
  const facts: Facts = {
    depends: dependsOnValues(plan, plan.params),
    plan,
    read: plan.params.filter((param) => names.has(param.name)),
    secrets: realSecrets(plan.params),
    values: new Set(
      plan.params
        .filter((param) => received(param) !== undefined && hasNode(param))
        .map(shown)
    ),
  };
  return REACH.filter(([, entered]) => entered(facts)).map(([state]) => state);
};

// ---------------------------------------------------------------------------
// Constructed histories: each enters one declared state on every base
// ---------------------------------------------------------------------------

const ACME = 0;
const ACME_UPPER = 1;
const MAIN = 2;
const NUMBER_STRING = 3;

const param = (kind: Kind, source: Source, value = ACME): HistoryParam => ({
  kind,
  source,
  value,
});
const given = (kind: Kind, value = ACME) => param(kind, "given", value);
const framePart = (kind: PartKind, ref: number): HistoryPart => ({
  kind,
  ref,
});

/**
 * Puts the named params and frames first, keeping the generated ones after
 * them. Generated frames that can depend on a value or transform one are
 * dropped, and generated fills too, so they cannot move a construction out
 * of its law's domain.
 */
const prepend = (
  generated: History,
  params: readonly HistoryParam[],
  parts: readonly HistoryPart[],
  fill: readonly number[] = []
): History => ({
  fill: [...fill, ...generated.fill.map(() => NO_FILL)].slice(0, MAX_PARAMS),
  mode: generated.mode,
  params: [...params, ...generated.params].slice(0, MAX_PARAMS),
  parts: [
    ...parts,
    ...generated.parts.filter(
      (generatedPart) =>
        !VALUE_DEPENDENT.has(generatedPart.kind) &&
        !COMPUTED.has(generatedPart.kind)
    ),
  ].slice(0, MAX_PARTS),
});

/** Replaces the generated params and frames, keeping the mode. */
const only = (
  generated: History,
  params: readonly HistoryParam[],
  parts: readonly HistoryPart[],
  fill: readonly number[] = []
): History => ({
  fill: [...fill],
  mode: generated.mode,
  params: [...params],
  parts: [...parts],
});

type Build = (generated: History) => History;

const constructed: Record<string, Build> = {
  [BOOLEAN_READ]: (g) =>
    prepend(
      g,
      [given("boolean"), given("string")],
      [framePart("read", 0), framePart("command", 0), framePart("read", 1)]
    ),
  [BRANCHES]: (g) =>
    only(
      g,
      [given("enum"), given("string")],
      [framePart("branch", 0), framePart("read", 1)]
    ),
  [CODE_READ]: (g) => prepend(g, [given("string")], [framePart("code", 0)]),
  [CONSTANT_EQUAL]: (g) =>
    prepend(
      g,
      [given("string", MAIN)],
      [framePart("read", 0), framePart("constant", MAIN)]
    ),
  [DEPENDS_SHARED]: (g) =>
    only(
      g,
      [given("string"), given("url")],
      [framePart("guard", 0), framePart("read", 1), framePart("constant", MAIN)]
    ),
  [DEPENDS_UNIQUE]: (g) =>
    only(
      g,
      [given("string", MAIN), given("enum")],
      [framePart("branch", 1), framePart("read", 0)]
    ),
  [DERIVED_EQUAL]: (g) =>
    only(
      g,
      [given("string"), given("string", ACME_UPPER)],
      [framePart("derived", 0), framePart("read", 1)]
    ),
  [EMBEDDED]: (g) =>
    prepend(
      g,
      [given("string"), given("string")],
      [framePart("command", 0), framePart("read", 1)]
    ),
  [EMPTY_READ]: (g) =>
    prepend(
      g,
      [param("string", "empty"), given("string")],
      [framePart("read", 0), framePart("read", 1)]
    ),
  [FILL_COLLIDES]: (g) =>
    prepend(
      g,
      [given("string"), given("string", ACME_UPPER)],
      [framePart("read", 0), framePart("read", 1)],
      [1]
    ),
  [FILL_EMPTY]: (g) =>
    prepend(
      g,
      [param("url", "omitted"), given("string")],
      [framePart("read", 0), framePart("command", 0)],
      [0]
    ),
  [FILL_HOLDS]: (g) =>
    prepend(
      g,
      [given("secret", MAIN), given("string", MAIN)],
      [framePart("read", 0), framePart("read", 1)],
      [NO_FILL, 0]
    ),
  [FILL_SECRET]: (g) =>
    prepend(
      g,
      [given("secret"), given("string")],
      [framePart("read", 0), framePart("read", 1), framePart("constant", ACME)],
      [0]
    ),
  [FILL_SECRET_EMBEDDED]: (g) =>
    only(
      g,
      [given("secret"), given("string", ACME_UPPER)],
      [framePart("command", 0), framePart("read", 1)],
      [1]
    ),
  [FILL_SHARED]: (g) =>
    prepend(
      g,
      [given("string"), given("string")],
      [framePart("read", 0), framePart("read", 1)],
      [0]
    ),
  [GUARDS]: (g) =>
    only(
      g,
      [given("number", 0), given("string", MAIN)],
      [framePart("guard", 0), framePart("read", 1)]
    ),
  [HOLDS_SECRET]: (g) =>
    prepend(
      g,
      [given("secret", MAIN), given("string", MAIN)],
      [framePart("read", 1)]
    ),
  [INCLUDED]: (g) =>
    prepend(
      g,
      [given("string"), given("string")],
      [framePart("include", 0), framePart("read", 1)]
    ),
  [INLINE]: (g) =>
    only(
      g,
      [given("secret"), given("string")],
      [framePart("inline", 0), framePart("read", 1)]
    ),
  [INLINE_READ]: (g) =>
    prepend(
      g,
      [given("string"), given("string")],
      [framePart("inlineRead", 0), framePart("read", 1)]
    ),
  [NOTHING]: (g) =>
    prepend(
      g,
      [given("string")],
      [framePart("nothing", 0), framePart("read", 0)]
    ),
  [NO_PARAMS]: (g) =>
    only(g, [], [framePart("constant", ACME), framePart("nothing", 0)]),
  [NO_VALUES]: (g) =>
    only(g, [param("string", "default", MAIN)], [framePart("read", 0)]),
  [NUMBER_COMPARED]: (g) =>
    only(
      g,
      [given("number", 0), given("string", NUMBER_STRING)],
      [framePart("threshold", 0), framePart("read", 1)]
    ),
  [OMITTED_READ]: (g) =>
    prepend(
      g,
      [param("string", "omitted")],
      [framePart("read", 0), framePart("snippet", 0)]
    ),
  [PLACEHOLDER_READ]: (g) =>
    prepend(
      g,
      [param("secret", "none"), param("secret", "none")],
      [framePart("read", 0), framePart("read", 1)]
    ),
  [SECRET_DERIVED]: (g) =>
    only(
      g,
      [given("secret"), given("string", MAIN)],
      [framePart("prefixed", 0), framePart("read", 1)]
    ),
  [SECRET_PRESET]: (g) =>
    prepend(g, [param("secret", "default")], [framePart("read", 0)]),
  [SECRET_SHARED]: (g) =>
    prepend(
      g,
      [given("string"), given("secret")],
      [framePart("read", 1), framePart("read", 0)]
    ),
  [SECRET_UNREAD]: (g) =>
    only(
      g,
      [given("secret"), given("string", MAIN)],
      [framePart("constant", ACME), framePart("read", 1)]
    ),
  [SHARED]: (g) =>
    prepend(
      g,
      [given("string"), given("url")],
      [framePart("read", 0), framePart("read", 1)]
    ),
  [SNIPPET]: (g) =>
    prepend(
      g,
      [given("string"), given("string")],
      [framePart("snippet", 0), framePart("read", 1)]
    ),
  [STATIC]: (g) =>
    prepend(
      g,
      [given("string")],
      [framePart("static", 0), framePart("read", 0)]
    ),
  [SWAPS]: (g) =>
    only(
      g,
      [given("string"), given("string", MAIN)],
      [framePart("swap", 0), framePart("read", 1)]
    ),
};

const FIXED_SEED = 20_261_124;

const histories = (states: readonly string[]) => ({
  arbitrary: historyArbitrary,
  constructed: states.map((state) => ({
    build: (generated: History): History =>
      (constructed[state] ?? ((g: History) => g))(generated),
    enters: [state],
    name: state,
  })),
  fixedSeeds: [FIXED_SEED],
  measured: ALL_STATES.filter((state) => !states.includes(state)),
  runs: 100,
  states,
});

/** No change that only adds work goes unnoticed (gap check directive). */
const WORK = { ratio: 1 };

// ---------------------------------------------------------------------------
// Calibrations: wrong answers each law must reject
// ---------------------------------------------------------------------------

const mapView = (
  trace: readonly Observation[],
  checkpoint: string,
  change: (view: View) => View
) =>
  trace.map((observation) =>
    observation.checkpoint === checkpoint
      ? { ...observation, value: change(observation.value as View) }
      : observation
  );

const relabelFrame =
  (index: number, labels: (frame: Label[]) => Label[]) => (view: View) => ({
    ...view,
    labels: view.labels.map((frame, frameIndex) =>
      frameIndex === index ? labels(frame) : frame
    ),
  });

const firstPart = (plan: Plan, kind: PartKind) =>
  plan.parts.findIndex((candidate) => candidate.kind === kind);

// ---------------------------------------------------------------------------
// The properties: one law each
// ---------------------------------------------------------------------------

oracleProperty({
  calibrations: [
    {
      corrupt: (trace) =>
        mapView(
          trace,
          "rendered",
          relabelFrame(0, (frame) =>
            frame.map((label) => ({ ...label, name: `${label.name}x` }))
          )
        ),
      history: { constructed: SECRET_SHARED },
      law: OWN_NAME,
      name: "a secret labelled with another param's name",
    },
  ],
  check: checkFrames(
    OWN_NAME,
    (part, depends) =>
      EMBEDS.has(part.kind) || (!depends && READS.has(part.kind))
  ),
  driver,
  histories: histories([
    SHARED,
    SECRET_SHARED,
    PLACEHOLDER_READ,
    SECRET_PRESET,
    EMPTY_READ,
    OMITTED_READ,
    BOOLEAN_READ,
    EMBEDDED,
    SNIPPET,
    INCLUDED,
    CODE_READ,
    INLINE_READ,
    NUMBER_COMPARED,
    HOLDS_SECRET,
    NO_VALUES,
  ]),
  id: "core.param-labels.own-name",
  law: {
    authority:
      'content/docs/concepts/params.mdx, Highlighting: "When you interpolate a param directly into a `t` template, it becomes a param node"; Secrets: "secret params carry `secret: true`, and placeholders also carry `placeholder: true`"; packages/core/test/render.test.ts, "skips null, undefined, and booleans". Decision by OrcDev (GitHub TheOrcDev), 2026-11-24: a param that renders "" or is omitted still gets a node, and a param whose value holds a real secret is marked secret, with holdsSecret.',
    limits:
      "Values come from a five-string pool, two numbers, and two booleans; a template that depends on values follows the values-decide law instead.",
    statement:
      "For every read of a param in a template whose shape does not depend on values, a value that is not a boolean renders as one param node with that param's name, empty when the value is \"\" or an optional param was omitted, with placeholder for an unset secret, and secret for a secret param or a value that holds a real secret's value (with holdsSecret when the param is not a secret); a boolean renders nothing.",
  },
  model,
  owns: [
    "src/render.ts#render",
    "src/render.ts#renderExample",
    "src/template.ts",
    "src/fill.ts",
    "src/secrets.ts",
  ],
  reached: reachedBy,
  resolve,
  work: WORK,
});

oracleProperty({
  calibrations: [
    {
      corrupt: (trace, plan) =>
        mapView(
          trace,
          "rendered",
          relabelFrame(firstPart(plan, "constant"), () => [
            {
              name: nameOf(0),
              text: plan.parts[firstPart(plan, "constant")]?.constant ?? "",
            },
          ])
        ),
      history: { constructed: CONSTANT_EQUAL },
      law: NOTHING_ELSE,
      name: "a constant labelled as the param it equals",
    },
  ],
  check: checkFrames(
    NOTHING_ELSE,
    (part, depends) =>
      !depends &&
      (part.kind === "constant" ||
        part.kind === "nothing" ||
        part.kind === "static" ||
        COMPUTED.has(part.kind))
  ),
  driver,
  histories: histories([
    CONSTANT_EQUAL,
    DERIVED_EQUAL,
    INLINE,
    SECRET_DERIVED,
    NOTHING,
    NO_PARAMS,
    STATIC,
  ]),
  id: "core.param-labels.nothing-else",
  law: {
    authority:
      'content/docs/concepts/params.mdx, Highlighting: "If you transform the value first, as in projectId.toUpperCase(), it renders as plain text" (quoted without its template syntax); content/docs/components/agent-prompt.mdx, Editable params: "Text the template derives from a param … keeps the value it was rendered with".',
    limits:
      "Constants come from the value pool; the transforms are toUpperCase, a prefix, and an inline command around the value.",
    statement:
      "For every interpolation that is not a read of a param, in a template whose shape does not depend on values, such as a constant, undefined, or a value computed from a param, the text renders as plain text, even when it equals a param's value.",
  },
  model,
  owns: [
    "src/render.ts#render",
    "src/render.ts#renderExample",
    "src/template.ts",
    "src/fill.ts",
    "src/secrets.ts",
  ],
  reached: reachedBy,
  resolve,
  work: WORK,
});

oracleProperty({
  calibrations: [
    {
      corrupt: (trace, plan) =>
        mapView(
          trace,
          "rendered",
          relabelFrame(firstPart(plan, "read"), () => [
            { name: nameOf(1), text: "acme" },
          ])
        ),
      history: { constructed: DEPENDS_SHARED },
      law: VALUES_DECIDE,
      name: "a shared value labelled in a value-dependent template",
    },
  ],
  check: checkFrames(
    VALUES_DECIDE,
    (part, depends) => depends && !EMBEDS.has(part.kind)
  ),
  driver,
  histories: histories([
    DEPENDS_SHARED,
    DEPENDS_UNIQUE,
    GUARDS,
    BRANCHES,
    SWAPS,
  ]),
  id: "core.param-labels.values-decide",
  law: {
    authority:
      "Decision by OrcDev (GitHub TheOrcDev), 2026-11-24: when the labelling run does not line up with the real one, a value is a param only when exactly one param has it; a value that several params share renders as plain text.",
    limits:
      "The values that decide are a branch on one pool value, a guard that rejects anything outside the pool, and a comparison with a number; empty and omitted values are never labelled here.",
    statement:
      "For every template that branches on or rejects a value, so that fresh values would interpolate differently, an interpolated non-empty string or number gets a param label only when exactly one param has that value, with that param's flags.",
  },
  model,
  owns: [
    "src/render.ts#render",
    "src/render.ts#renderExample",
    "src/template.ts",
    "src/fill.ts",
    "src/secrets.ts",
  ],
  reached: reachedBy,
  resolve,
  work: WORK,
});

oracleProperty({
  calibrations: [
    {
      corrupt: (trace) =>
        trace.map((observation) =>
          observation.checkpoint === "listed"
            ? {
                ...observation,
                value: (observation.value as unknown[]).slice(1),
              }
            : observation
        ),
      history: { constructed: SHARED },
      law: LISTED_ONCE,
      name: "a read param missing from the list",
    },
  ],
  check: (_plan, observations, expected) =>
    threw(observations, LISTED_ONCE) ??
    differs(
      "listed",
      LISTED_ONCE,
      valueAt(observations, "listed"),
      expected.listed
    ) ??
    pass,
  driver,
  histories: histories([
    SHARED,
    SECRET_SHARED,
    EMPTY_READ,
    OMITTED_READ,
    EMBEDDED,
    DEPENDS_UNIQUE,
  ]),
  id: "core.param-labels.listed-once",
  law: {
    authority:
      'content/docs/reference/core.mdx, Filling params: "`listParams(rendered)` returns each param once, in the order they first appear: `{ name, value, secret?, placeholder? }`".',
    limits: "As for the labelling laws, whose labels it lists.",
    statement:
      "For every rendered tree, listParams returns each labelled param exactly once, in order of first appearance, with the value and flags it first rendered with.",
  },
  model,
  owns: [
    "src/render.ts#render",
    "src/render.ts#renderExample",
    "src/template.ts",
    "src/fill.ts",
    "src/secrets.ts",
  ],
  reached: reachedBy,
  resolve,
  work: WORK,
});

oracleProperty({
  calibrations: [
    {
      corrupt: (trace) =>
        mapView(trace, "filled", (view) => ({ ...view, text: "" })),
      history: { constructed: FILL_SHARED },
      law: FILL_EQUALS_RENDER,
      name: "a fill that loses the copied text",
    },
  ],
  check: (_plan, observations, expected) => {
    const filled = valueAt(observations, "filled") as View | undefined;
    const listed = valueAt(observations, "filledListed") as
      | Listed[]
      | undefined;
    return (
      threw(observations, FILL_EQUALS_RENDER) ??
      differs(
        "filled labels",
        FILL_EQUALS_RENDER,
        unmarkedFrames(filled?.labels),
        unmarkedFrames(expected.filled.labels)
      ) ??
      differs(
        "filled list",
        FILL_EQUALS_RENDER,
        listed?.map(unmarked),
        expected.filledListed.map(unmarked)
      ) ??
      differs(
        "filled text",
        FILL_EQUALS_RENDER,
        filled?.text,
        expected.filled.text
      ) ??
      pass
    );
  },
  driver,
  histories: histories([
    FILL_SHARED,
    FILL_COLLIDES,
    FILL_EMPTY,
    FILL_SECRET,
    FILL_HOLDS,
    CONSTANT_EQUAL,
    EMBEDDED,
  ]),
  id: "core.param-labels.fill-equals-render",
  law: {
    authority:
      'content/docs/components/agent-prompt.mdx, Editable params: "As the reader types, both views, the copied text, and the openIn links use their value. It also fills params with the same name in embedded commands and snippets"; packages/core/test/fill.test.ts, "matches what render gives with the same values".',
    limits:
      "Fills come from three strings; number and boolean params, params a frame transforms, and templates that depend on values get no fill. Secret marks are the secret-marks law's.",
    statement:
      "For every set of non-empty fill values w for params that are read and never transformed, fillParams(render(d, v), w) gives the same labels, list, and plain text as render(d, { ...v, ...w }), inside embedded definitions too.",
  },
  model,
  owns: [
    "src/render.ts#render",
    "src/render.ts#renderExample",
    "src/template.ts",
    "src/fill.ts",
    "src/secrets.ts",
  ],
  reached: reachedBy,
  resolve,
  work: WORK,
});

oracleProperty({
  calibrations: [
    {
      corrupt: (trace) =>
        mapView(trace, "rendered", (view) => ({
          ...view,
          segments: view.segments.map(
            ({ secret: _secret, ...segment }) => segment
          ),
        })),
      history: { constructed: SECRET_DERIVED },
      law: SECRET_MARKS,
      name: "text around a real secret left unmarked",
    },
  ],
  check: checkSecrets,
  driver,
  histories: histories([
    SECRET_DERIVED,
    SECRET_UNREAD,
    HOLDS_SECRET,
    INLINE,
    FILL_SECRET,
    FILL_HOLDS,
    FILL_SECRET_EMBEDDED,
    SECRET_PRESET,
    PLACEHOLDER_READ,
  ]),
  id: "core.param-labels.secret-marks",
  law: {
    authority:
      'content/docs/components/agent-prompt.mdx, Open in an agent: "A prompt with a real secret gets no links at all, because URLs end up in browser history and logs"; content/docs/concepts/params.mdx, Secrets. Decision by OrcDev (GitHub TheOrcDev), 2026-11-24: text that holds a real secret blocks the links.',
    limits:
      "A secret split across two interpolations is not recognized. fillParams runs without the definition, so after a fill a typed value equal to a secret that the tree never shows is not marked.",
    statement:
      "For every rendered tree, a segment carries secret exactly when it is a secret param's or its text holds a real secret's value, in embedded definitions too. After a fill, a segment is marked exactly when it is a secret param's, its text holds the value of a real secret param that the filled tree shows, or it was not filled and held a secret it rendered with.",
  },
  model,
  owns: [
    "src/render.ts#render",
    "src/render.ts#renderExample",
    "src/template.ts",
    "src/fill.ts",
    "src/secrets.ts",
  ],
  reached: reachedBy,
  resolve,
  work: WORK,
});

oracleProperty({
  calibrations: [
    {
      corrupt: (trace) => [
        ...trace,
        { checkpoint: "error", value: "a planted throw" },
      ],
      history: { constructed: GUARDS },
      law: NO_THROW,
      name: "a render that throws",
    },
  ],
  check: (_plan, observations) => threw(observations, NO_THROW) ?? pass,
  driver,
  histories: histories([BRANCHES, GUARDS, NO_PARAMS, NO_VALUES]),
  id: "core.param-labels.no-throw",
  law: {
    authority:
      "packages/core/src/render.ts: render and renderExample return a Rendered for a definition and the values its params accept.",
    limits: "Only the outcome is judged here; the other laws judge the tree.",
    statement:
      "For every definition and every set of values its params accept, including templates that branch on or validate a value, render and renderExample return a tree.",
  },
  model,
  owns: [
    "src/render.ts#render",
    "src/render.ts#renderExample",
    "src/template.ts",
    "src/fill.ts",
    "src/secrets.ts",
  ],
  reached: reachedBy,
  resolve,
  work: WORK,
});
