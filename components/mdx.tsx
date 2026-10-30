import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

import { AgentPromptDemo } from "@/components/docs/agent-prompt-demo";
import { ConnectDialogDemo } from "@/components/docs/connect-dialog-demo";
import { GetStartedDemo } from "@/components/docs/get-started-demo";
import { InstallCommand } from "@/components/docs/install-command";
import { TryItDemo } from "@/components/docs/try-it-demo";

export const getMDXComponents = (components?: MDXComponents) =>
  ({
    ...defaultMdxComponents,
    AgentPromptDemo,
    ConnectDialogDemo,
    GetStartedDemo,
    InstallCommand,
    TryItDemo,
    ...components,
  }) satisfies MDXComponents;

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
