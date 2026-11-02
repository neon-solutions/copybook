import type { Metadata } from "next";

import { AgentsView } from "@/components/landing/agents-view";
import { CliView } from "@/components/landing/cli-view";
import { Hero } from "@/components/landing/hero";
import { StudioWindow } from "@/components/landing/studio-window";
import type { StudioView } from "@/components/landing/studio-window";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    types: { "text/markdown": "/index.md" },
  },
};

const VIEWS: StudioView[] = [
  { id: "agents", label: "Agents", panel: <AgentsView /> },
  { id: "cli", label: "CLI", panel: <CliView /> },
];

const Page = () => <Hero window={<StudioWindow views={VIEWS} />} />;

export default Page;
