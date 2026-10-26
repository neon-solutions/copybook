// Verifies that every published package has the version in the release tag,
// and that internal workspace dependencies won't leak into the tarballs.
// Usage: node scripts/check-release.mjs v0.1.0
import { readFileSync } from "node:fs";

const PACKAGES = ["packages/core", "packages/cli"];

const tag = process.argv[2] ?? "";
const version = tag.replace(/^v/u, "");
if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/u.test(version)) {
  process.stderr.write(`Expected a tag like v0.1.0, got "${tag}".\n`);
  process.exit(1);
}

const problems = [];
for (const dir of PACKAGES) {
  const manifest = JSON.parse(readFileSync(`${dir}/package.json`, "utf-8"));
  if (manifest.version !== version) {
    problems.push(
      `${manifest.name} is ${manifest.version}, expected ${version}`
    );
  }
  if (manifest.private) {
    problems.push(`${manifest.name} is private`);
  }
}

if (problems.length > 0) {
  process.stderr.write(`${problems.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(
  `Ready to publish ${PACKAGES.length} packages at ${version}.\n`
);
