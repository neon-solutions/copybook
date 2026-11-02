import { render, toText } from "@copybook/core";
import { llms, loader } from "fumadocs-core/source";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { defineDocs } from "fumadocs-mdx/macro";

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

/**
 * Processed Markdown keeps MDX components as tags, which agents can't use.
 * Install commands become the npm command, and live demos become a link.
 */
const toAgentMarkdown = (markdown: string, url: string) =>
  markdown
    .replaceAll(INSTALL_COMMAND, (tag) => {
      const [, item = ""] = tag.split('"');
      return `\`\`\`bash\n${toText(render(addComponent, { item, registryUrl }))}\n\`\`\``;
    })
    .replaceAll(DEMO, `_Interactive preview: ${siteConfig.url}${url}_`);

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${toAgentMarkdown(await page.data.getText("processed"), page.url)}`,
});
