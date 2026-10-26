import { render } from "@prompt-manager/core";

import { CommandTabs } from "@/components/prompt-manager/command-tabs";
import type { CommandTab } from "@/components/prompt-manager/command-tabs";
import {
  init,
  packageManagers,
  setupPrompt,
} from "@/content/definitions/get-started";

const tabs: CommandTab[] = [
  {
    id: "prompt",
    kind: "prompt",
    label: "Prompt",
    rendered: render(setupPrompt),
  },
  ...packageManagers.map((packageManager) => ({
    id: packageManager,
    label: packageManager,
    rendered: render(init, { packageManager }),
  })),
];

export const GetStarted = () => (
  <div className="w-full max-w-2xl text-left">
    <CommandTabs defaultTab="pnpm" tabs={tabs} />
  </div>
);
