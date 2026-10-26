import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const HomeLayout = ({ children }: Readonly<{ children: ReactNode }>) => (
  <>
    <SiteHeader />
    <main className="flex flex-1 flex-col justify-center">{children}</main>
    <SiteFooter />
  </>
);

export default HomeLayout;
