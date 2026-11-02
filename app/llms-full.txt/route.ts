import { homeMarkdown } from "@/lib/home";
import { docsLlms } from "@/lib/source";

export const revalidate = false;

export const GET = async () =>
  new Response(`${homeMarkdown()}\n${await docsLlms.full()}`);
