"use client";

import { Button } from "@/components/ui/button";

/** `rendered` formats a prompt's Markdown. `source` shows it as written. */
export type PromptView = "rendered" | "source";

const VIEWS = [
  { label: "Preview", value: "rendered" },
  { label: "Markdown", value: "source" },
] as const;

interface ViewToggleProps {
  onChange: (view: PromptView) => void;
  view: PromptView;
}

/** Switches a prompt between its formatted view and its Markdown. */
export const ViewToggle = ({ onChange, view }: ViewToggleProps) => (
  <fieldset className="flex items-center">
    <legend className="sr-only">Prompt view</legend>
    {VIEWS.map((option) => (
      <Button
        aria-pressed={view === option.value}
        key={option.value}
        onClick={() => onChange(option.value)}
        size="xs"
        variant={view === option.value ? "secondary" : "ghost"}
      >
        {option.label}
      </Button>
    ))}
  </fieldset>
);
