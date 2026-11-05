const PROMPT =
  "Set me up for Acme. Fetch https://acme.dev/prompts/setup.md and follow it.";

export const SetupButton = () => (
  <button onClick={() => navigator.clipboard.writeText(PROMPT)} type="button">
    Set up agent
  </button>
);
