import { render } from "@copybook/core";

import { CommandTabs } from "@/components/copybook/command-tabs";
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
