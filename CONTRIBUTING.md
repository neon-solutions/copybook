# Contributing to Copybook

Thanks for helping improve Copybook. Contributions can target the published packages, the site and docs, the shadcn registry components, or the examples.

## Before you start

Open a pull request directly for focused bug fixes and docs improvements. Please open an issue first for larger changes, especially ones that affect:

- the public API of `@copybook/core` (definitions, params, the rendered tree);
- CLI commands, flags, config, or output formats (manifest, snapshots, results);
- test runners, sandboxes, or eval adapters, since these execute code;
- package publishing and release automation.

## Development setup

Repository development uses Node.js 24 (see `.node-version`) and the pnpm version pinned in `package.json`. The published CLI supports Node.js 22.12 or newer. `@copybook/core` runs in any modern browser or JavaScript runtime.

```bash
pnpm install --frozen-lockfile
pnpm dev          # Next.js site: landing, docs, registry
pnpm check        # Ultracite (oxlint + oxfmt)
pnpm fix          # auto-fix lint and formatting
pnpm typecheck
pnpm test
```

## Repository map

| Area | Location |
| --- | --- |
| Core library | `packages/core` |
| CLI (catalog, test, eval, studio server) | `packages/cli` |
| Studio UI | `packages/studio` |
| Site, docs, and registry | `app`, `components`, `content/docs`, `registry` |
| Example consumer | `examples/acme` |

The repository root is a private Next.js application. Only packages under `packages/*` that aren't marked `private` get published.

## Guidelines

- Follow the code standards in [AGENTS.md](AGENTS.md). Run `pnpm fix` before committing (the pre-commit hook does this too).
- `@copybook/core` must stay dependency-free and must not import `node:*` modules.
- Render functions must be pure. The same params must always produce the same output.
- Add tests next to the code you change (`packages/*/test`).
- Don't commit secrets. Tests and evals that need real credentials read them from the environment.

## Releasing

`@copybook/core` and `@copybook/cli` share one version.

1. Bump `version` in `packages/core/package.json` and `packages/cli/package.json`, and move the changelog's "Unreleased" section under the new version.
2. Merge to `main`, then publish a GitHub release tagged `v<version>`.
3. The `Publish` workflow verifies the versions, runs every check, and publishes both packages to npm with provenance. Prereleases go to the `next` dist-tag.

Never publish from a local machine.
