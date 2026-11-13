"use client";

import { renderExample } from "@copybook/core";
import { setUpWithAgent } from "@copybook/example-acme/create-project";

import { AgentPrompt } from "@/components/copybook/agent-prompt";

const rendered = renderExample(setUpWithAgent);

/** The Acme "Create project" prompt, with params readers fill in. */
export const AgentPromptDemo = () => (
  <div className="not-prose">
    <AgentPrompt
      defaultView="rendered"
      editParams={["orgId", "projectId"]}
      openIn={["cursor", "claude-code", "codex"]}
      rendered={rendered}
      viewToggle
    />
  </div>
);
