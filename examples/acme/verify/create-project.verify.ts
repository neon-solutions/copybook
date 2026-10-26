import {
  defineEval,
  fileContains,
  fileExists,
  ranInOrder,
  succeeds,
} from "@prompt-manager/cli";

import { setUpWithAgent } from "../src/create-project";

// The Acme CLI is fictional, so the eval stubs it. Every call is still
// recorded, so assertions see what the agent ran.
const ACME_STUB = `
case "$1" in
  init) echo "export default { services: { postgres: {} } };" > acme.ts ;;
  deploy) echo "DATABASE_URL=postgresql://eval@localhost/app" > .env.local ;;
esac
echo "acme $1: ok"
`;

// Global installs of the fictional CLI succeed without touching the machine.
const NPM_STUB = `
case "$*" in
  *acme@latest*) echo "added 1 package"; exit 0 ;;
esac
PATH="\${PATH#*:}" exec npm "$@"
`;

const NPX_STUB = `
if [ "$1" = "acme@latest" ]; then shift; exec acme "$@"; fi
PATH="\${PATH#*:}" exec npx "$@"
`;

export const createProjectEval = defineEval(setUpWithAgent, {
  agents: ["literal", "claude-code"],
  assert: [
    ranInOrder([
      /acme@latest/u,
      /acme init .*--project-id round-bar-12345678/u,
      "acme deploy",
    ]),
    fileExists("acme.ts"),
    fileContains(".env.local", "DATABASE_URL="),
    succeeds("npm run build"),
  ],
  maxCostUsd: 2,
  passRate: 0.67,
  sandbox: { template: "evals/template" },
  shims: {
    acme: { script: ACME_STUB },
    npm: { script: NPM_STUB },
    npx: { script: NPX_STUB },
  },
  timeoutMs: 10 * 60_000,
  trials: 3,
});
