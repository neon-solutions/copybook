import { ArrowRightIcon, GithubLogoIcon } from "@phosphor-icons/react/dist/ssr";

import { GetStartedDemo } from "@/components/docs/get-started-demo";
import {
  LinkButton,
  Section,
  SectionHeader,
} from "@/components/landing/primitives";
import { githubUrl } from "@/lib/shared";

/** The closing call to action, built from Copybook definitions itself. */
export const Start = () => (
  <Section id="start">
    <div className="flex flex-col items-center text-center">
      <SectionHeader
        className="items-center"
        eyebrow="Start here"
        id="start"
        title="Set it up in one command"
      >
        <p>
          Run the CLI in your project, or paste the prompt into your coding
          agent and let it do the setup.
        </p>
      </SectionHeader>
      <div className="w-full max-w-2xl">
        <GetStartedDemo />
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <LinkButton href="/docs/quick-start" size="lg">
          Read the quick start
          <ArrowRightIcon aria-hidden="true" />
        </LinkButton>
        <LinkButton external href={githubUrl} size="lg" variant="outline">
          <GithubLogoIcon aria-hidden="true" weight="fill" />
          View on GitHub
        </LinkButton>
      </div>
    </div>
  </Section>
);
