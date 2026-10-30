import { listVariants, render, toText } from "@copybook/core";

import { tryIt } from "../src/ai-gateway";
import type { MODELS } from "../src/ai-gateway";

export const TryIt = ({
  endpoint,
  model,
}: {
  endpoint: string;
  model: (typeof MODELS)[number];
}) => (
  <div>
    {listVariants(tryIt).map((variant) => (
      <pre key={variant.key} title={variant.label}>
        {toText(render(tryIt, { endpoint, model }, { variant: variant.key }))}
      </pre>
    ))}
  </div>
);
