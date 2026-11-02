/** Escapes `<`, so a value can't close the script tag. */
const LESS_THAN = /</gu;

/** Structured data for search engines, as the Next.js JSON-LD guide renders it. */
export const JsonLd = ({ data }: { data: Record<string, unknown> }) => (
  <script
    // oxlint-disable-next-line react/no-danger -- JSON-LD has to be inline text, and it's escaped
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(data).replaceAll(LESS_THAN, String.raw`<`),
    }}
    type="application/ld+json"
  />
);
