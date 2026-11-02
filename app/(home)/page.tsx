import type { Metadata } from "next";

import { Hero } from "@/components/landing/hero";
import { StudioWindow } from "@/components/landing/studio-window";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const Page = () => <Hero window={<StudioWindow />} />;

export default Page;
