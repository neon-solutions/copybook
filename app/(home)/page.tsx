import { Hero } from "@/components/landing/hero";
import { Start } from "@/components/landing/start";
import { StudioWindow } from "@/components/landing/studio-window";

const Page = () => (
  <>
    <Hero window={<StudioWindow />} />
    <Start />
  </>
);

export default Page;
