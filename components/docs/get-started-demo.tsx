import { render } from "@copybook/core";

import { CommandTabs } from "@/components/copybook/command-tabs";
import type { CommandTab } from "@/components/copybook/command-tabs";
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

/** The agent prompt plus one tab per package manager, all definitions. */
export const GetStartedDemo = () => (
  <div className="not-prose w-full text-left">
    <CommandTabs defaultTab="pnpm" tabs={tabs} />
  </div>
);
