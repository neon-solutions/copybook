import { render } from "@prompt-manager/core";

import { CommandTabs } from "@/components/prompt-manager/command-tabs";
import { packageManagers } from "@/content/definitions/get-started";
import { addComponent } from "@/content/definitions/registry";
import { registryUrl } from "@/lib/shared";

/** `shadcn add` commands for one registry item, per package manager. */
export const InstallCommand = ({ item }: { item: string }) => (
  <div className="not-prose">
    <CommandTabs
      defaultTab="pnpm"
      tabs={packageManagers.map((packageManager) => ({
        id: packageManager,
        label: packageManager,
        rendered: render(addComponent, { item, packageManager, registryUrl }),
      }))}
    />
  </div>
);
