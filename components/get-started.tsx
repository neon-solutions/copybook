import { CommandTabs } from "@/components/command-tabs";
import type { CommandTab } from "@/components/command-tabs";
import { INIT_COMMANDS, SETUP_AGENT_PROMPT } from "@/lib/get-started";

const TABS: readonly CommandTab[] = [
  { id: "prompt", kind: "prompt", label: "Prompt", value: SETUP_AGENT_PROMPT },
  { id: "pnpm", label: "pnpm", value: INIT_COMMANDS.pnpm },
  { id: "npm", label: "npm", value: INIT_COMMANDS.npm },
  { id: "yarn", label: "yarn", value: INIT_COMMANDS.yarn },
  { id: "bun", label: "bun", value: INIT_COMMANDS.bun },
];

export const GetStarted = () => (
  <div className="w-full max-w-2xl text-left">
    <CommandTabs defaultTab="pnpm" tabs={TABS} />
  </div>
);
