// A stand-in for the console page that shows the agent prompt, so
// `copybook usages` has product code to scan.
import { render, toText } from "@copybook/core";

import { setUpWithAgent } from "../src/create-project";

export const CreateProjectDone = ({
  orgId,
  projectId,
}: {
  orgId: string;
  projectId: string;
}) => <pre>{toText(render(setUpWithAgent, { orgId, projectId }))}</pre>;
