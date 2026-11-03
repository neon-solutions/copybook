// Checks what search engines and link previews see on every page in the
// sitemap: a unique title and description of the right length, a canonical
// URL, a 1200x630 PNG Open Graph image with alt text, the large X card,
// JSON-LD that parses, and a canonical Link header on the page's Markdown.
//
// Run it against a production build:
//   pnpm build && pnpm start --port 3100
//   node scripts/check-seo.mjs http://localhost:3100

const MAX_TITLE = 60;
const MIN_DESCRIPTION = 70;
const MAX_DESCRIPTION = 160;
const IMAGE = { height: 630, width: 1200 };
const PNG_SIGNATURE = "89504e470d0a1a0a";

const TRAILING_SLASH = /\/$/u;
const LOC = /<loc>(?<url>[^<]+)<\/loc>/gu;
const TITLE = /<title>(?<title>[^<]*)<\/title>/u;
const TAG = /<(?<name>meta|link)\s(?<attributes>[^>]*)>/gu;
const ATTRIBUTE = /(?<key>[\w:-]+)="(?<value>[^"]*)"/gu;
const JSON_LD =
  /<script type="application\/ld\+json">(?<json>[\s\S]*?)<\/script>/gu;
const CANONICAL_LINK = /<(?<url>[^>]+)>;\s*rel="canonical"/u;
const ENTITY = /&(?<entity>amp|lt|gt|quot|#x27|#39);/gu;
const ENTITIES = {
  "#39": "'",
  "#x27": "'",
  amp: "&",
  gt: ">",
  lt: "<",
  quot: '"',
};

const base = (process.argv[2] ?? "http://localhost:3000").replace(
  TRAILING_SLASH,
  ""
);

/** The same path on the server being checked, whatever host the page names. */
const local = (url) => {
  const { pathname, search } = new URL(url);
  return `${base}${pathname}${search}`;
};

/** `https://copybook.dev` and `https://copybook.dev/` are the same page. */
const sameUrl = (url, other) =>
  Boolean(url && other) && new URL(url).href === new URL(other).href;

const decode = (text) =>
  text.replaceAll(ENTITY, (_match, entity) => ENTITIES[entity]);

/** The title, meta tags by name or property, links by rel, and JSON-LD. */
const parseHead = (html) => {
  const meta = new Map();
  const links = new Map();
  for (const tag of html.matchAll(TAG)) {
    const attributes = Object.fromEntries(
      [...tag.groups.attributes.matchAll(ATTRIBUTE)].map((attribute) => [
        attribute.groups.key,
        decode(attribute.groups.value),
      ])
    );
    if (tag.groups.name === "meta") {
      const key = attributes.property ?? attributes.name;
      if (key && !meta.has(key)) {
        meta.set(key, attributes.content);
      }
    } else if (attributes.rel && !links.has(attributes.rel)) {
      links.set(attributes.rel, attributes.href);
    }
  }
  const title = html.match(TITLE)?.groups.title;
  const jsonLd = [...html.matchAll(JSON_LD)].map((block) => block.groups.json);
  return { jsonLd, links, meta, title: title && decode(title) };
};

const images = new Map();

/** Fetches each image once, however many pages share it. */
const checkImage = (url) => {
  if (!images.has(url)) {
    images.set(
      url,
      (async () => {
        const response = await fetch(local(url));
        if (!response.ok) {
          return `og:image ${url} answered ${response.status}`;
        }
        const type = response.headers.get("content-type");
        const bytes = Buffer.from(await response.arrayBuffer());
        if (
          type !== "image/png" ||
          bytes.toString("hex", 0, 8) !== PNG_SIGNATURE
        ) {
          return `og:image ${url} isn't a PNG (${type})`;
        }
        // The IHDR chunk holds the width and height, right after the signature.
        const width = bytes.readUInt32BE(16);
        const height = bytes.readUInt32BE(20);
        if (width !== IMAGE.width || height !== IMAGE.height) {
          return `og:image ${url} is ${width}x${height}, not ${IMAGE.width}x${IMAGE.height}`;
        }
      })()
    );
  }
  return images.get(url);
};

/** The Markdown copy of a page, which should name the page as canonical. */
const markdownPath = (pathname) =>
  pathname === "/" ? "/index.md" : `/llms.mdx${pathname}/content.md`;

const checkMarkdown = async (loc) => {
  const path = markdownPath(new URL(loc).pathname);
  const response = await fetch(`${base}${path}`);
  if (!response.ok) {
    return [`${path} answered ${response.status}`];
  }
  const link = response.headers.get("link")?.match(CANONICAL_LINK);
  return sameUrl(link?.groups.url, loc)
    ? []
    : [`${path} has no Link header naming ${loc} as canonical`];
};

const lengthProblems = (title, description) => {
  const problems = [];
  if (!title) {
    problems.push("no <title>");
  } else if (title.length > MAX_TITLE) {
    problems.push(
      `title is ${title.length} characters, over ${MAX_TITLE}: set a shorter metaTitle`
    );
  }
  if (!description) {
    problems.push("no meta description");
  } else if (
    description.length < MIN_DESCRIPTION ||
    description.length > MAX_DESCRIPTION
  ) {
    problems.push(
      `description is ${description.length} characters, outside ${MIN_DESCRIPTION}-${MAX_DESCRIPTION}: set metaDescription in the frontmatter`
    );
  }
  return problems;
};

const jsonLdProblems = (blocks) =>
  blocks.flatMap((json) => {
    try {
      return JSON.parse(json)["@context"] === "https://schema.org"
        ? []
        : ["JSON-LD has no schema.org @context"];
    } catch {
      return ["JSON-LD doesn't parse"];
    }
  });

const checkPage = async (loc) => {
  const response = await fetch(local(loc));
  if (!response.ok) {
    return { loc, problems: [`answered ${response.status}`] };
  }
  const { jsonLd, links, meta, title } = parseHead(await response.text());
  const description = meta.get("description");
  const image = meta.get("og:image");

  const problems = [
    ...lengthProblems(title, description),
    ...jsonLdProblems(jsonLd),
    ...(await checkMarkdown(loc)),
  ];
  if (!sameUrl(links.get("canonical"), loc)) {
    problems.push(`canonical is ${links.get("canonical")}, not ${loc}`);
  }
  if (meta.get("twitter:card") !== "summary_large_image") {
    problems.push("twitter:card isn't summary_large_image");
  }
  if (jsonLd.length === 0) {
    problems.push("no JSON-LD");
  }
  if (image) {
    const imageProblem = await checkImage(image);
    if (imageProblem) {
      problems.push(imageProblem);
    }
    if (!meta.get("og:image:alt")) {
      problems.push("og:image has no alt text");
    }
  } else {
    problems.push("no og:image");
  }

  return { description, loc, problems, title };
};

/** Pages that share a title or description, which search results can't tell apart. */
const duplicates = (pages, key) => {
  const seen = new Map();
  for (const page of pages) {
    if (page[key]) {
      seen.set(page[key], [...(seen.get(page[key]) ?? []), page.loc]);
    }
  }
  return [...seen.values()]
    .filter((locs) => locs.length > 1)
    .map((locs) => `same ${key} on ${locs.join(", ")}`);
};

const fetchText = async (path) => {
  const response = await fetch(`${base}${path}`);
  return response.ok ? response.text() : "";
};

const [robots, sitemap] = await Promise.all([
  fetchText("/robots.txt"),
  fetchText("/sitemap.xml"),
]);
const locs = [...sitemap.matchAll(LOC)].map((match) => match.groups.url);

const pages = await Promise.all(locs.map(checkPage));
const problems = [
  ...(robots.includes("Sitemap: ")
    ? []
    : ["robots.txt doesn't name the sitemap"]),
  ...(locs.length > 0 ? [] : ["the sitemap lists no pages"]),
  ...pages.flatMap((page) =>
    page.problems.map((problem) => `${page.loc}: ${problem}`)
  ),
  ...duplicates(pages, "title"),
  ...duplicates(pages, "description"),
];

if (problems.length > 0) {
  process.stderr.write(
    `${problems.length} SEO problems:\n${problems.map((problem) => `- ${problem}`).join("\n")}\n`
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `${pages.length} pages and ${images.size} images have what search engines and link previews need.\n`
  );
}
