import { OgHomeCard } from "@/components/og/og-card";
import { HOME } from "@/lib/home";
import { renderOgImage } from "@/lib/og";
import { siteConfig } from "@/lib/shared";

/** The landing page's image, and the fallback for any page without one. */
export const alt = `${siteConfig.name}: ${HOME.title}`;
export const contentType = "image/png";
export { ogImageSize as size } from "@/lib/shared";

const Image = () => renderOgImage(<OgHomeCard />);

export default Image;
