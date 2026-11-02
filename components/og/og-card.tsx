import type { ReactNode } from "react";

import { OgAurora } from "@/components/og/og-aurora";
import type { AuroraLayout } from "@/components/og/og-aurora";
import { HOME } from "@/lib/home";

/** The landing page's dark theme. */
const COLORS = {
  background: "#040506",
  faint: "#6a6b6c",
  foreground: "#ffffff",
  muted: "#9c9c9d",
  neon: "#00e599",
} as const;

const MONO = "Geist Mono";
const SENTENCE_BREAK = /(?<=\.)\s+/u;
const TRAILING_PUNCTUATION = /[\s,.;:]+$/u;

/** Cuts at a word boundary, so a long description still fits two lines. */
const truncate = (text: string, max: number) => {
  if (text.length <= max) {
    return text;
  }
  const cut = text.slice(0, text.lastIndexOf(" ", max));
  return `${cut.replace(TRAILING_PUNCTUATION, "")}…`;
};

/** Short titles set large; long ones step down to stay within two lines. */
const titleSize = (title: string) => {
  if (title.length <= 20) {
    return 84;
  }
  return title.length <= 36 ? 68 : 56;
};

const Mark = ({ size }: { size: number }) => (
  <svg height={size} viewBox="0 0 24 24" width={size}>
    <path d="M0 0 14.5 6.5V17.5L0 24V17L13 12 0 7Z" fill={COLORS.foreground} />
    <rect fill={COLORS.neon} height="2.5" width="7" x="17" y="15" />
  </svg>
);

const Wordmark = () => (
  <div style={{ alignItems: "center", display: "flex", gap: 16 }}>
    <Mark size={44} />
    <div style={{ fontSize: 34, fontWeight: 500 }}>Copybook</div>
  </div>
);

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      color: COLORS.muted,
      fontFamily: MONO,
      fontSize: 20,
      letterSpacing: 1.6,
      textTransform: "uppercase",
    }}
  >
    {children}
  </div>
);

const Frame = ({
  children,
  layout,
  seed,
}: {
  children: ReactNode;
  layout: AuroraLayout;
  seed: string;
}) => (
  <div
    style={{
      backgroundColor: COLORS.background,
      color: COLORS.foreground,
      display: "flex",
      flexDirection: "column",
      fontFamily: "Inter",
      height: "100%",
      padding: "56px 64px",
      position: "relative",
      width: "100%",
    }}
  >
    <OgAurora layout={layout} seed={seed} />
    {children}
  </div>
);

/** The landing page's hero: eyebrow, headline, and meta strip, centered. */
export const OgHomeCard = () => (
  <Frame layout="center" seed="/">
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flex: 1,
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Wordmark />
      <div style={{ display: "flex", marginTop: 48 }}>
        <Eyebrow>{HOME.eyebrow}</Eyebrow>
      </div>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          fontSize: 72,
          letterSpacing: -0.5,
          lineHeight: 1.12,
          marginTop: 24,
        }}
      >
        {HOME.title.split(SENTENCE_BREAK).map((sentence) => (
          <div key={sentence}>{sentence}</div>
        ))}
      </div>
      <div
        style={{
          color: COLORS.muted,
          display: "flex",
          fontFamily: MONO,
          fontSize: 18,
          gap: 16,
          marginTop: 40,
        }}
      >
        {HOME.meta.map((item, index) => (
          <div key={item} style={{ display: "flex", gap: 16 }}>
            {index > 0 ? <div style={{ color: COLORS.faint }}>|</div> : null}
            <div>{item}</div>
          </div>
        ))}
      </div>
    </div>
  </Frame>
);

/** A docs page: its section, title, and description, with the bars on the right. */
export const OgDocsCard = ({
  description,
  path,
  section,
  title,
}: {
  description?: string;
  /** Shown at the bottom, without the scheme: `copybook.dev/docs/...`. */
  path: string;
  section: string;
  title: string;
}) => (
  <Frame layout="start" seed={path}>
    <Wordmark />
    <div
      style={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        justifyContent: "center",
        maxWidth: 760,
      }}
    >
      <Eyebrow>{section}</Eyebrow>
      <div
        style={{
          fontSize: titleSize(title),
          fontWeight: 500,
          letterSpacing: -1,
          lineHeight: 1.08,
          marginTop: 20,
        }}
      >
        {title}
      </div>
      {description ? (
        <div
          style={{
            color: COLORS.muted,
            fontSize: 30,
            lineHeight: 1.4,
            marginTop: 24,
          }}
        >
          {truncate(description, 120)}
        </div>
      ) : null}
    </div>
    <div style={{ color: COLORS.faint, fontFamily: MONO, fontSize: 20 }}>
      {path}
    </div>
  </Frame>
);
