import { render, toText } from "@prompt-manager/core";

import type { readme } from "@/prompts";
import { greet } from "@/prompts";

// Type-only imports don't count as rendering a definition.
export type Readme = typeof readme;

export const Page = () => <pre>{toText(render(greet))}</pre>;
