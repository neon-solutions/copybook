// Rendered Markdown is positional and never reorders, so index keys are stable.
/* oxlint-disable react/no-array-index-key */
import type { Rendered } from "@copybook/core";
import { toBlocks } from "@copybook/core/blocks";
import type {
  Block,
  CodeBlock,
  CodeContent,
  CommandBlock,
  Inline,
} from "@copybook/core/blocks";
import type { ReactNode } from "react";

import { TerminalIcon } from "@/components/copybook/icons";
import { segmentClassName } from "@/components/copybook/rendered-text";
import { cn } from "@/lib/utils";

/** Prompt headings sit under the page's own `h1` and `h2`. */
const HEADING_TAGS = {
  1: "h3",
  2: "h4",
  3: "h5",
  4: "h6",
  5: "h6",
  6: "h6",
} as const;

// Flex would drop the list markers, so lists space with margins.
const LIST_CLASS_NAME = "marker:text-muted-foreground space-y-1.5 pl-5";

const Code = ({ content }: { content: readonly CodeContent[] }) =>
  content.map((item, index) =>
    item.type === "param" ? (
      <span
        className={segmentClassName(item)}
        data-copybook-param={item.name}
        key={index}
        title={item.name}
      >
        {item.text}
      </span>
    ) : (
      item.text
    )
  );

const Inlines = ({ inlines }: { inlines: readonly Inline[] }) =>
  inlines.map((inline, index) => {
    switch (inline.type) {
      case "text": {
        return inline.text;
      }
      case "param": {
        return <Code content={[inline]} key={index} />;
      }
      case "inlineCode": {
        return (
          <code
            className="bg-muted rounded-sm px-1 py-0.5 font-mono text-xs"
            data-copybook-command={inline.id}
            key={index}
          >
            <Code content={inline.children} />
          </code>
        );
      }
      case "strong": {
        return (
          <strong className="font-semibold" key={index}>
            <Inlines inlines={inline.children} />
          </strong>
        );
      }
      case "emphasis": {
        return (
          <em key={index}>
            <Inlines inlines={inline.children} />
          </em>
        );
      }
      case "link": {
        return (
          <a
            className="text-primary underline underline-offset-4"
            href={inline.href}
            key={index}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Inlines inlines={inline.children} />
          </a>
        );
      }
      default: {
        return null;
      }
    }
  });

const CodeBlockView = ({ block }: { block: CodeBlock }) => (
  <div className="bg-muted/40 border" data-copybook-id={block.id}>
    {block.lang ? (
      <div className="text-muted-foreground border-b px-3 py-1 font-mono text-xs">
        {block.lang}
      </div>
    ) : null}
    <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
      <code data-lang={block.lang}>
        <Code content={block.children} />
      </code>
    </pre>
  </div>
);

const CommandBlockView = ({ block }: { block: CommandBlock }) => (
  <pre
    className="bg-muted/40 flex items-start gap-2 overflow-x-auto border px-3 py-2 font-mono text-xs leading-relaxed"
    data-copybook-command={block.id}
  >
    <TerminalIcon className="text-muted-foreground mt-0.5 shrink-0" />
    <code>
      <Code content={block.children} />
    </code>
  </pre>
);

const Blocks = ({ blocks }: { blocks: readonly Block[] }) =>
  blocks.map((block, index): ReactNode => {
    switch (block.type) {
      case "heading": {
        const Tag = HEADING_TAGS[block.level];
        return (
          <Tag
            className={cn(
              "text-foreground font-semibold",
              block.level === 1 ? "text-base" : "text-sm"
            )}
            key={index}
          >
            <Inlines inlines={block.children} />
          </Tag>
        );
      }
      case "paragraph": {
        return (
          <p key={index}>
            <Inlines inlines={block.children} />
          </p>
        );
      }
      case "list": {
        const items = block.items.map((item, itemIndex) => (
          <li className="space-y-2 pl-1" key={itemIndex}>
            <Blocks blocks={item.children} />
          </li>
        ));
        return block.ordered ? (
          <ol
            className={cn(LIST_CLASS_NAME, "list-decimal")}
            key={index}
            start={block.start}
          >
            {items}
          </ol>
        ) : (
          <ul className={cn(LIST_CLASS_NAME, "list-disc")} key={index}>
            {items}
          </ul>
        );
      }
      case "code": {
        return <CodeBlockView block={block} key={index} />;
      }
      case "command": {
        return <CommandBlockView block={block} key={index} />;
      }
      case "blockquote": {
        return (
          <blockquote
            className="text-muted-foreground flex flex-col gap-3 border-l-2 pl-3"
            key={index}
          >
            <Blocks blocks={block.children} />
          </blockquote>
        );
      }
      case "thematicBreak": {
        return <hr key={index} />;
      }
      default: {
        return null;
      }
    }
  });

interface RenderedMarkdownProps {
  className?: string;
  rendered: Rendered;
}

/**
 * Renders a prompt's Markdown as formatted content, with params highlighted.
 * Copy `toText(rendered)` to get the Markdown itself.
 */
export const RenderedMarkdown = ({
  className,
  rendered,
}: RenderedMarkdownProps) => (
  <div className={cn("flex flex-col gap-3 text-sm leading-relaxed", className)}>
    <Blocks blocks={toBlocks(rendered)} />
  </div>
);
