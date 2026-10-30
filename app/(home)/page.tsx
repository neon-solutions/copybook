import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Problems } from "@/components/landing/problems";
import { Start } from "@/components/landing/start";
import { StudioWindow } from "@/components/landing/studio-window";

const Page = () => (
  <>
    <Hero window={<StudioWindow />} />
    <Problems />
    <HowItWorks />
    <Start />
  </>
);

export default Page;
