import { OgHomeCard } from "@/components/og/og-card";
import { HOME } from "@/lib/home";
import { renderOgImage } from "@/lib/og";
import { siteConfig } from "@/lib/shared";

/** The landing page's image, and the fallback for any page without one. */
export const alt = `${siteConfig.name}: ${HOME.title}`;
export const contentType = "image/png";
export { OG_SIZE as size } from "@/lib/og";

const Image = () => renderOgImage(<OgHomeCard />);

export default Image;
