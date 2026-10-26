import { render, toText } from "@prompt-manager/core";

import { psql } from "../src/commands";

export const ProjectsFooter = () => (
  <p>
    Passwordless connect with psql: <code>{toText(render(psql))}</code>
  </p>
);
