import { listVariants, render, toText } from "@copybook/core";

import { connect } from "../src/connect";

export const ConnectDialog = ({ endpoint }: { endpoint: string }) => (
  <div>
    {listVariants(connect).map((variant) => (
      <pre key={variant.key} title={variant.label}>
        {toText(render(connect, { endpoint }, { variant: variant.key }))}
      </pre>
    ))}
  </div>
);
