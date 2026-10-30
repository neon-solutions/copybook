import Link from "next/link";

import { Section, SectionHeader } from "@/components/landing/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { problemTracks } from "@/content/landing";

/** Pain in the team's own words, the fix, and the feature behind it. */
export const Problems = () => (
  <Section id="problems">
    <SectionHeader
      eyebrow="Where it drifts"
      id="problems"
      title="Copy-paste content breaks quietly"
    >
      <p>
        Snippets and prompts live as strings across your components. Nothing
        fails when they go stale, so your users find out first.
      </p>
    </SectionHeader>

    <Tabs defaultValue={problemTracks[0]?.id}>
      <div className="max-w-full overflow-x-auto">
        <TabsList variant="line">
          {problemTracks.map((track) => (
            <TabsTrigger key={track.id} value={track.id}>
              {track.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {problemTracks.map((track) => (
        <TabsContent keepMounted key={track.id} value={track.id}>
          <ul className="bg-card shadow-key divide-border mt-6 divide-y rounded-2xl">
            {track.problems.map((problem) => (
              <li
                className="flex flex-col gap-3 p-6 md:flex-row md:items-center md:gap-8"
                key={problem.feature}
              >
                <p className="text-subheading text-foreground text-pretty md:flex-1">
                  “{problem.pain}”
                </p>
                <p className="text-muted-foreground text-sm leading-6 text-pretty md:flex-1">
                  {problem.fix}
                </p>
                <Link
                  className="bg-secondary text-foreground hover:bg-accent shrink-0 self-start rounded-sm px-2 py-1 font-mono text-xs transition-colors md:self-center"
                  href={problem.href}
                >
                  {problem.feature}
                </Link>
              </li>
            ))}
          </ul>
        </TabsContent>
      ))}
    </Tabs>
  </Section>
);
