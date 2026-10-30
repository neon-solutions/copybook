/** Copy for the landing page. Every claim maps to a shipped feature. */

export interface Problem {
  /** The feature that fixes it, shown as a mono chip. */
  feature: string;
  fix: string;
  href: string;
  pain: string;
}

export interface ProblemTrack {
  id: string;
  label: string;
  problems: readonly Problem[];
}

export const problemTracks: readonly ProblemTrack[] = [
  {
    id: "works",
    label: "Does it work",
    problems: [
      {
        feature: "copybook test",
        fix: "Every snippet gets syntax and type checks on each pull request, and can run for real against fixtures in CI.",
        href: "/docs/guides/testing",
        pain: "The Prisma snippet broke three releases ago. A user told us.",
      },
      {
        feature: "t.cmd()",
        fix: "Define each command once and embed it everywhere. Change it, and every prompt and snippet that uses it shows up in the diff.",
        href: "/docs/concepts/templates",
        pain: "The CLI renamed a flag, and half our dialogs still use the old one.",
      },
    ],
  },
  {
    id: "agents",
    label: "Agents",
    problems: [
      {
        feature: "copybook eval",
        fix: "Run each prompt through Claude Code or Codex in a sandbox, several times, and check which commands the agent actually ran.",
        href: "/docs/guides/evals",
        pain: "The setup prompt worked with last month's agent.",
      },
      {
        feature: "passRate",
        fix: "Evals record a pass rate per prompt and agent, and keep the history in git, so you can compare one version with the next.",
        href: "/docs/guides/evals",
        pain: "We can't tell whether the new prompt is any better.",
      },
    ],
  },
  {
    id: "where",
    label: "Where it's shown",
    problems: [
      {
        feature: "copybook usages",
        fix: "Declare placements on each definition, then scan your product code for every component that renders it.",
        href: "/docs/reference/cli",
        pain: "Nobody knows which screens show this snippet.",
      },
      {
        feature: "copybook list",
        fix: "Content lives in one catalog with stable ids, so a single definition renders in every place that needs it.",
        href: "/docs/concepts/definitions",
        pain: "Two dialogs explain the same setup in different words.",
      },
    ],
  },
  {
    id: "changed",
    label: "What changed",
    problems: [
      {
        feature: "copybook snapshot",
        fix: "Each definition renders to a Markdown snapshot committed next to your code, so git log is its history.",
        href: "/docs/concepts/snapshots",
        pain: "When did this prompt last change, and why?",
      },
      {
        feature: "copybook report",
        fix: "Pull requests get a comment with each changed snippet and prompt, where it renders, its test results, and the rendered diff.",
        href: "/docs/guides/ci",
        pain: "Reviewing copy means reading TypeScript diffs.",
      },
    ],
  },
];

/** What Studio shows, one card per question the project answers. */
export const questions = [
  {
    answer:
      "A catalog of every definition, with live previews and params you can edit.",
    command: "copybook list",
    question: "What do we show?",
  },
  {
    answer: "Declared placements, plus the product files that render each one.",
    command: "copybook usages",
    question: "Where is it shown?",
  },
  {
    answer: "Test results per tier, and eval pass rates per agent.",
    command: "copybook test",
    question: "Does it still work?",
  },
  {
    answer:
      "Snapshot history from git, and whether each snapshot is up to date.",
    command: "copybook check",
    question: "When did it change?",
  },
] as const;

export const faq = [
  {
    answer:
      "A TypeScript value made with `defineCommand`, `defineSnippet`, or `definePrompt`. It has a stable id, typed params with example values, and a template. Your product imports it to render it, and the CLI imports it to snapshot, test, and evaluate it.",
    question: "What is a definition?",
  },
  {
    answer:
      "No. Definitions live in your repo, snapshots are Markdown files next to them, and eval history goes on a git branch. Git is the only storage.",
    question: "Does it need a backend or a database?",
  },
  {
    answer:
      "`@copybook/core` is plain TypeScript with no dependencies, so it renders anywhere. The UI components are a shadcn registry for React, and they install into Radix and Base UI projects.",
    question: "Which frameworks does it work with?",
  },
  {
    answer:
      "Claude Code and Codex have built-in adapters, and you can write your own. Evals run in a sandbox and record which commands the agent ran, so assertions check what it did, not only what it said.",
    question: "Which agents can run the evals?",
  },
  {
    answer:
      "Agents run with their permission prompts bypassed, so `copybook eval` refuses to run outside CI unless you pass `--unsafe-local`. Cap the spend of a run with `--budget-usd`.",
    question: "Is it safe to run agents in evals?",
  },
  {
    answer:
      "Yes. Every definition renders to a Markdown snapshot, so pull requests show the text users will see. Studio shows each item with live params, no TypeScript required.",
    question: "Can people who don't write code review changes?",
  },
  {
    answer:
      "Not yet. Copybook is pre-release, and its APIs will change before 1.0.",
    question: "Is it ready for production?",
  },
] as const;
