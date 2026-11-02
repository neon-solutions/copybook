import { homeMarkdown } from "@/lib/home";

export const revalidate = false;

export const GET = () =>
  new Response(homeMarkdown(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
