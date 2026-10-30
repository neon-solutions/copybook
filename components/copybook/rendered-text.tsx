import { toSegments } from "@copybook/core";
import type { Rendered, Segment, TextFormat } from "@copybook/core";

import { cn } from "@/lib/utils";

const segmentClassName = (segment: Segment) => {
  if (segment.type === "fence") {
    return "text-muted-foreground";
  }
  if (segment.type !== "param") {
    return;
  }
  return cn(
    "rounded-sm px-0.5",
    segment.placeholder
      ? "bg-muted text-muted-foreground"
      : "bg-primary/10 text-primary"
  );
};

interface RenderedTextProps {
  format?: TextFormat;
  rendered: Rendered;
}

/** Renders a tree as text with params highlighted. Wrap it in a `<pre>`. */
export const RenderedText = ({ format, rendered }: RenderedTextProps) =>
  toSegments(rendered, format ? { format } : {}).map((segment, index) => (
    <span
      className={segmentClassName(segment)}
      data-copybook-param={segment.name}
      // Segments are positional and never reorder.
      // oxlint-disable-next-line react/no-array-index-key
      key={index}
      title={segment.type === "param" ? segment.name : undefined}
    >
      {segment.text}
    </span>
  ));

/** True when a real secret value (not a placeholder) would be copied. */
export const containsSecret = (rendered: Rendered) =>
  toSegments(rendered).some(
    (segment) => segment.secret === true && segment.placeholder !== true
  );
