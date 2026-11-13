import { AGENTS } from "@/components/copybook/agent-links";
import type { AgentId } from "@/components/copybook/agent-links";
import { Button } from "@/components/ui/button";

interface OpenInAgentProps {
  agents: readonly AgentId[];
  /** Fired when a link is followed, for analytics. */
  onOpen?: (agent: AgentId) => void;
  text: string;
}

/**
 * Links that open `text` in coding agents, pre-filled and unsent. Agents
 * that can't take text this long get a note instead of a link.
 */
export const OpenInAgent = ({ agents, onOpen, text }: OpenInAgentProps) => {
  const links = agents.map((agent) => ({
    agent,
    label: AGENTS[agent].label,
    url: AGENTS[agent].link(text),
  }));
  const tooLong = links
    .filter(({ url }) => url === undefined)
    .map(({ label }) => label);
  const hasLink = tooLong.length < links.length;

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-1 border-t py-1 pr-1 pl-3 text-xs">
      {hasLink ? <span className="mr-1">Open in</span> : null}
      {links.map(({ agent, label, url }) =>
        url === undefined ? null : (
          <Button
            key={agent}
            nativeButton={false}
            onClick={() => onOpen?.(agent)}
            render={
              url.startsWith("https:") ? (
                <a
                  aria-label={`Open in ${label}`}
                  href={url}
                  rel="noopener noreferrer"
                  target="_blank"
                />
              ) : (
                <a aria-label={`Open in ${label}`} href={url} />
              )
            }
            size="xs"
            variant="ghost"
          >
            {label}
          </Button>
        )
      )}
      {tooLong.length > 0 ? (
        <span className="py-1.5">
          {hasLink
            ? `Too long to open in ${tooLong.join(" or ")}.`
            : "Too long to open as a link."}{" "}
          Copy it instead.
        </span>
      ) : null}
    </div>
  );
};
