import { definePrompt } from "@copybook/core";

import { deploy, init, install, login } from "./commands";
import { orgId, projectId } from "./params";

/** The last step of the "Create project" dialog. */
export const setUpWithAgent = definePrompt({
  id: "console.create-project.agent",
  params: { orgId, projectId },
  placements: ["console/create-project/done"],
  template: (t, params) => t`
    Set up this app on Acme.
    1. ${t.cmd(install)}. If that fails, use \`npx acme@latest\` in place of \`acme\`.
       If an acme command opens a browser sign-in, tell me to finish it there. If that times out or fails, ask me to run ${t.cmd(login)}, then retry.
    2. In the project root:
       ${t.cmd(init, params)}
    3. ${t.cmd(deploy)}. It provisions the services in acme.ts and pulls their env vars into \`.env.local\` (or \`.env\` if it exists).
    4. Wire each service into the app's code using those env vars. Consult the installed Acme agent skills for best practices, e.g., what database driver to use given the app architecture and hosting runtime.
    5. Prove it works: ${t.cmd("npm run build")} must pass, then start the app. Test each wired service end to end.
    6. Report what changed, the command output that proves step 5, and anything that failed.
  `,
  title: "Set up Acme with your coding agent",
});
