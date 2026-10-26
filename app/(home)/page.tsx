import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { GetStarted } from "@/components/get-started";
import { Hero } from "@/components/hero";
import { Badge } from "@/components/ui/badge";
import { githubUrl } from "@/lib/shared";

const QUESTIONS = [
  { answer: "Every definition has a stable id", question: "What do we show?" },
  { answer: "Declared placements per definition", question: "Where is it?" },
  { answer: "Sandboxed tests and agent evals", question: "Does it work?" },
  { answer: "Rendered snapshots in git", question: "When did it change?" },
] as const;

const Page = () => (
  <Hero
    badge={
      <Badge render={<Link href="/docs" />} variant="secondary">
        Pre-release
        <span aria-hidden="true">·</span>
        Read the docs
        <ArrowRightIcon data-icon="inline-end" />
      </Badge>
    }
    buttons={{
      primary: { text: "Get started", url: "/docs" },
      secondary: { text: "GitHub", url: githubUrl },
    }}
    description="Prompt Manager turns the code examples and coding-agent prompts in your UI into typed, versioned definitions. You always know what you show, where it's shown, whether it still works, and when it changed."
    heading="Manage your product's snippets and agent prompts as code"
    media={
      <div className="flex w-full flex-col items-center gap-8">
        <GetStarted />
        <ul className="bg-border grid w-full max-w-4xl grid-cols-2 gap-px border text-left md:grid-cols-4">
          {QUESTIONS.map((item) => (
            <li
              className="bg-background flex flex-col gap-1 p-4"
              key={item.question}
            >
              <span className="text-sm font-semibold">{item.question}</span>
              <span className="text-muted-foreground text-xs">
                {item.answer}
              </span>
            </li>
          ))}
        </ul>
      </div>
    }
  />
);

export default Page;
