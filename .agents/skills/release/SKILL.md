---
name: release
description: Releases a new version of @copybook/core and @copybook/cli to npm. Bumps both packages, dates the changelog, pushes to main, creates the GitHub release that triggers the Publish workflow, waits for the npm deployment approval, and verifies the result on npm. Use when the user asks to release, publish, ship, or cut a new version (e.g. "release 0.1.2", "publish to npm", "let's do a new release").
---

# Release

`@copybook/core` and `@copybook/cli` share one version. A GitHub release tagged `v<version>` runs `.github/workflows/publish.yml`, which verifies the versions, runs every check, and publishes both packages with trusted publishing (OIDC) and provenance. Never publish from a local machine, and never add an npm token: the packages only accept publishes from that workflow.

npm never lets a version number be reused. Confirm the version with the user before pushing, and treat the release as the point of no return.

## 1. Preflight

Work from a clean, up-to-date `main`. If the working tree has unrelated changes, leave them alone and work in a fresh clone or worktree instead.

```sh
git fetch origin && git log --oneline "$(git describe --tags --abbrev=0 origin/main)"..origin/main
gh run list --branch main --workflow quality.yml --limit 1   # must be success on the HEAD commit
gh release list --limit 3
```

- Pick the version with the user: patch for fixes and docs, minor for new features. While on 0.x, breaking changes are a minor bump.
- Read `content/docs/changelog.mdx`. The "Unreleased" section should cover every package-facing change since the last tag; add missing entries in the same style. Site-only changes (landing page, docs site) don't belong there.

## 2. Bump and push

1. Set `"version"` in `packages/core/package.json` and `packages/cli/package.json`. Don't touch `packages/studio` or `examples/*`.
2. In `content/docs/changelog.mdx`, replace `## Unreleased` with the version and a date line, matching earlier entries:

   ```md
   ## 0.1.1

   Released November 2, 2026.
   ```

3. Check, commit, and push:

   ```sh
   node scripts/check-release.mjs v<version>   # "Ready to publish 2 packages at <version>."
   git commit -am "chore(release) set core and cli to <version>"
   git push origin main
   ```

## 3. Create the release

Use the changelog bullets for this version as the notes. Target the exact bump commit, not just `main`.

```sh
gh release create v<version> --target "$(git rev-parse HEAD)" --title v<version> --notes-file <notes.md> --latest
```

For a prerelease (`0.2.0-beta.1`), pass `--prerelease` instead of `--latest`; the workflow then publishes to the `next` dist-tag and `latest` stays put.

## 4. Approve the deployment

The `npm` environment only accepts `v*` tags and requires a reviewer. The run waits until a maintainer approves it; an agent can't. Give the user the run link and ask them to open it, click **Review deployments**, tick `npm`, and click **Approve and deploy**.

```sh
gh run list --workflow publish.yml --limit 1 --json databaseId,status,url
gh run watch <run-id> --exit-status
```

## 5. Verify

The registry cache can show the old version for a few minutes, so query the exact version and retry until it resolves.

```sh
npm view @copybook/core@<version> version dist.attestations.provenance.predicateType
npm view @copybook/cli@<version> version dependencies.@copybook/core dist-tags.latest
cd "$(mktemp -d)" && npm init -y >/dev/null && npm i @copybook/cli@<version> && npx copybook --version
```

Check both versions resolve, provenance is `https://slsa.dev/provenance/v1`, the CLI depends on the same `@copybook/core` version, and `copybook --version` prints the new version. Report the release and run links.

## When a run fails

Read the failing step with `gh run view <run-id> --log-failed`.

- **Failed before "Publish with provenance"** (checks, version mismatch): nothing reached npm. Fix it on `main`, delete the release and tag (`gh release delete v<version> --cleanup-tag`), and create the release again.
- **Failed during or after publishing**: check `npm view` for each package. A version that reached npm is permanent, so fix the problem and release the next patch version for both packages.
- **401 or 404 on publish**: the trusted publisher settings on npmjs.com (package → Settings) must name `neon-solutions/copybook`, workflow `publish.yml`, and environment `npm`. Ask the user to fix them; don't fall back to a token.
- The log warning `Failed to replace env in config: ${NODE_AUTH_TOKEN}` is expected and harmless.
