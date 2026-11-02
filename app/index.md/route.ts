import { homeMarkdown } from "@/lib/home";
import { canonicalLink } from "@/lib/shared";

export const revalidate = false;

export const GET = () =>
  new Response(homeMarkdown(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Link: canonicalLink("/"),
    },
  });
