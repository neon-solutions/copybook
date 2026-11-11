"use client";

import { render } from "@copybook/core";
import { setUpWithAgent } from "@copybook/example-acme/create-project";
import { useState } from "react";

import { AgentPrompt } from "@/components/copybook/agent-prompt";
import { ParamField } from "@/components/docs/param-field";

/** The Acme "Create project" prompt, with editable params. */
export const AgentPromptDemo = () => {
  const [orgId, setOrgId] = useState("org-summer-dust-12345678");
  const [projectId, setProjectId] = useState("round-bar-12345678");

  return (
    <div className="not-prose flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <ParamField label="orgId" onChange={setOrgId} value={orgId} />
        <ParamField
          label="projectId"
          onChange={setProjectId}
          value={projectId}
        />
      </div>
      <AgentPrompt
        defaultView="rendered"
        rendered={render(setUpWithAgent, { orgId, projectId })}
        viewToggle
      />
    </div>
  );
};
