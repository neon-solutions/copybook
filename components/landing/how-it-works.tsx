import {
  AppWindowIcon,
  CodeIcon,
  SealCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { ComponentType } from "react";

import { Section, SectionHeader } from "@/components/landing/primitives";

const STEPS: {
  code: string;
  icon: ComponentType<{ className?: string }>;
  text: string;
  title: string;
}[] = [
  {
    code: `definePrompt({
  id: "console.create-project.agent",
  params: { orgId, projectId },
  template: (t, values) => t\`…\`,
});`,
    icon: CodeIcon,
    text: "Write each snippet, command, or prompt as a typed definition, with example values for its params.",
    title: "Define",
  },
  {
    code: `<AgentPrompt
  rendered={render(prompt, values)}
/>`,
    icon: AppWindowIcon,
    text: "Render it with a registry component. Params are filled in, highlighted, and ready to copy.",
    title: "Render",
  },
  {
    code: `copybook check
copybook test
copybook eval`,
    icon: SealCheckIcon,
    text: "The CLI snapshots, tests, and evaluates every definition, on your machine or in CI.",
    title: "Check",
  },
];

export const HowItWorks = () => (
  <Section id="how-it-works">
    <SectionHeader
      eyebrow="How it works"
      id="how-it-works"
      title="Define once. Render anywhere. Check in CI."
    >
      <p>
        A definition is a typed TypeScript value with an id, params, and a
        template. Your product renders it, and the CLI checks it.
      </p>
    </SectionHeader>

    <ol className="grid gap-4 md:grid-cols-3">
      {STEPS.map((step, index) => (
        <li
          className="bg-card shadow-key flex flex-col gap-4 rounded-2xl p-6"
          key={step.title}
        >
          <div className="flex items-center justify-between">
            <span
              aria-hidden="true"
              className="bg-secondary text-foreground shadow-inset-highlight inline-flex size-10 items-center justify-center rounded-full"
            >
              <step.icon className="size-5" />
            </span>
            <span
              aria-hidden="true"
              className="text-muted-foreground font-mono text-xs"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>
          <h3 className="text-subheading text-foreground font-medium">
            {step.title}
          </h3>
          <p className="text-muted-foreground text-sm leading-6">{step.text}</p>
          <pre className="bg-muted text-foreground mt-auto overflow-x-auto rounded-lg p-4 font-mono text-xs leading-relaxed">
            <code>{step.code}</code>
          </pre>
        </li>
      ))}
    </ol>
  </Section>
);
