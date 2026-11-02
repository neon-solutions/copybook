import { render, toText } from "@copybook/core";
import { llms, loader } from "fumadocs-core/source";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { defineDocs } from "fumadocs-mdx/macro";

import {
  init,
  packageManagers,
  setupPrompt,
} from "@/content/definitions/get-started";
import { addComponent } from "@/content/definitions/registry";

import { docsRoute, registryUrl, siteConfig } from "./shared";

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
    schema: pageSchema,
  },
  meta: {
    schema: metaSchema,
  },
});

export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
});

const INSTALL_COMMAND = /<InstallCommand item="[^"]+" \/>/gu;
const DEMO = /^<[A-Z]\w*Demo \/>$/gmu;
const CALLOUT = /<Callout[^>]*>[\s\S]*?<\/Callout>/gu;
const CALLOUT_END = "</Callout>";

const fence = (lang: string, body: string) => `\`\`\`${lang}\n${body}\n\`\`\``;

/** Demos with a text form. The rest become a link to their page. */
const DEMO_MARKDOWN: Record<string, () => string> = {
  GetStartedDemo: () =>
    [
      "Paste this prompt into your coding agent:",
      fence("text", toText(render(setupPrompt))),
      "Or run `init` yourself, with your package manager:",
      fence(
        "bash",
        packageManagers
          .map(
            (packageManager) =>
              `${toText(render(init, { packageManager }))}  # ${packageManager}`
          )
          .join("\n")
      ),
    ].join("\n\n"),
};

const calloutToQuote = (tag: string) => {
  const [, afterTitle] = tag.split('title="');
  const title = afterTitle?.split('"')[0];
  const body = tag
    .slice(tag.indexOf(">") + 1, tag.lastIndexOf(CALLOUT_END))
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  return title ? `> **${title}.** ${body}` : `> ${body}`;
};

/**
 * Processed Markdown keeps MDX components as tags, which agents can't use.
 * Install commands become the npm command, callouts become blockquotes, and
 * live demos become their text, or a link when they have none.
 */
const toAgentMarkdown = (markdown: string, url: string) =>
  markdown
    .replaceAll(INSTALL_COMMAND, (tag) => {
      const [, item = ""] = tag.split('"');
      return fence("bash", toText(render(addComponent, { item, registryUrl })));
    })
    .replaceAll(CALLOUT, calloutToQuote)
    .replaceAll(DEMO, (tag) => {
      const name = tag.slice(1, tag.indexOf(" "));
      return (
        DEMO_MARKDOWN[name]?.() ??
        `_Interactive preview: ${siteConfig.url}${url}_`
      );
    });

export const docsLlms = llms(source, {
  renderPage: async (
    page
  ) => `# ${page.data.title} (${siteConfig.url}${page.url})

${toAgentMarkdown(await page.data.getText("processed"), page.url)}`,
});
