import { render, toText } from "@copybook/core";

import { psql } from "../src/commands";

// The agent fetches the Markdown prompt at this URL, which Copybook finds
// through the markdown source's url.
const AGENT_SETUP =
  "Set me up for Acme. Fetch https://acme.dev/prompts/agent-setup.md and follow it.";

export const ProjectsFooter = () => (
  <footer>
    <p>
      Passwordless connect with psql: <code>{toText(render(psql))}</code>
    </p>
    <button
      onClick={() => navigator.clipboard.writeText(AGENT_SETUP)}
      type="button"
    >
      Set up your agent
    </button>
  </footer>
);
