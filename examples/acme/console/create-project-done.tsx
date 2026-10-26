// A stand-in for the console page that shows the agent prompt, so
// `prompt-manager usages` has product code to scan.
import { render, toText } from "@prompt-manager/core";

import { setUpWithAgent } from "../src/create-project";

export const CreateProjectDone = ({
  orgId,
  projectId,
}: {
  orgId: string;
  projectId: string;
}) => <pre>{toText(render(setUpWithAgent, { orgId, projectId }))}</pre>;
