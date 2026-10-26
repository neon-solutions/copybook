// Fails when pnpm-lock.yaml resolves packages from a host other than the
// public npm registry or GitHub. Lockfiles written behind a private registry
// proxy keep the proxy host in tarball URLs, and that host doesn't resolve
// for anyone else.
import { readFileSync } from "node:fs";

const ALLOWED_HOSTS = new Set([
  "codeload.github.com",
  "github.com",
  "registry.npmjs.org",
]);
const TARBALL_PATTERN = /tarball:\s*https?:\/\/(?<host>[^/\s,}]+)/gu;
const PROXY_PATTERN = /https?:\/\/(?<host>[^/\s,}'"]*proxy[^/\s,}'"]*)/gu;

const lockfile = readFileSync("pnpm-lock.yaml", "utf-8");
const offending = new Set();

for (const pattern of [TARBALL_PATTERN, PROXY_PATTERN]) {
  for (const match of lockfile.matchAll(pattern)) {
    const host = match.groups?.host;
    if (host && !ALLOWED_HOSTS.has(host)) {
      offending.add(host);
    }
  }
}

if (offending.size > 0) {
  process.stderr.write(
    `pnpm-lock.yaml resolves packages from non-public hosts: ${[...offending].join(", ")}\n`
  );
  process.exitCode = 1;
} else {
  process.stdout.write("pnpm-lock.yaml only resolves from public hosts.\n");
}
