# Copybook

> Copybook is at 0.x, so minor releases can include breaking changes. The [changelog](content/docs/changelog.mdx) lists them.

Code snippets and agent prompts that live in product UIs, defined as code, tested, and tracked.

Developer tools now ship a lot of copy-paste content: "Connect" dialogs with snippets in five languages, model pages with per-framework examples, and "paste this into your coding agent" prompts. That content usually lives as strings scattered across components, so nobody can easily answer:

- **What** snippets and prompts do we show, and **where**?
- **Do** all the code examples still **work**?
- Do the prompts still **perform well** with today's agents?
- **When** did each one last change?

Copybook answers these by making every snippet, command, and prompt a typed, versioned definition:

```ts
import { defineCommand, definePrompt, p } from "@copybook/core";

export const init = defineCommand({
  id: "acme.init",
  params: { projectId: p.string().example("proj-example") },
  template: (t, { projectId }) => t`acme init --project-id ${projectId}`,
});

export const getStarted = definePrompt({
  id: "console.create-project.agent",
  placements: ["console/create-project"],
  params: { projectId: p.string().example("proj-example") },
  template: (t, params) => t`
    Set up this app on Acme.
    1. Install the CLI: ${t.cmd("npm i -g acme@latest")}
    2. In the project root: ${t.cmd(init, params)}
  `,
});
```

## Packages

| Package | Description |
| --- | --- |
| `@copybook/core` | Isomorphic, zero-dependency definitions and rendering. This is what your product imports. |
| `@copybook/cli` | `list`, `snapshot`, `check`, `test`, `eval`, `usages`, `report`, and `studio`. |
| Registry components | shadcn components for agent prompts, code variants, and command tabs. |

```bash
npx @copybook/cli init   # writes copybook.config.ts and installs both packages
```

Then, from your project:

```bash
npx copybook snapshot   # rendered snapshots; commit them
npx copybook check      # CI: fail when a snapshot is stale
npx copybook test       # parse, typecheck, and run snippets
npx copybook eval       # give prompts to coding agents (CI only)
npx copybook studio     # browse everything locally
```

The [docs](https://copybook.dev/docs) cover the [quick start](https://copybook.dev/docs/quick-start), each concept, and the registry components.

`examples/acme` models Neon's onboarding screens for a fictional "Acme DB", and every command above runs against it without an account.

## Development

This repository is a pnpm workspace. The Next.js site (landing page, docs, and shadcn registry) lives at the root, and the publishable packages live in `packages/*`.

```bash
pnpm install
pnpm dev         # site
pnpm check       # lint + format check (Ultracite)
pnpm typecheck
pnpm test
pnpm check:content   # snapshots of the site and Acme
pnpm test:content    # tests for the site and Acme
pnpm dev:studio      # Studio UI against examples/acme
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

[MIT](LICENSE.md)
