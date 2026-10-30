"use client";

import { listVariants, render } from "@copybook/core";
import { MODELS, tryIt } from "@copybook/example-acme/ai-gateway";
import { useId, useState } from "react";

import { CodeVariants } from "@/components/copybook/code-variants";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

type Model = (typeof MODELS)[number];

const scenarios = tryIt.dimensions.scenario ?? [];
const frameworks = tryIt.dimensions.framework ?? [];

const frameworkLabel = (value: string | undefined) =>
  frameworks.find((framework) => framework.value === value)?.label ?? "";

/** The AI Gateway model page's "Try it out": scenario × framework. */
export const TryItDemo = () => {
  const modelId = useId();
  const scenarioId = useId();
  const [model, setModel] = useState<Model>("claude-haiku-5-5");
  const [scenario, setScenario] = useState(scenarios[0]?.value ?? "");
  const items = listVariants(tryIt)
    .filter((variant) => variant.when.scenario === scenario)
    .map((variant) => ({
      key: variant.key,
      label: frameworkLabel(variant.when.framework),
      rendered: render(
        tryIt,
        {
          endpoint: "https://br-fancy-king-a1b2c3d4.us-east-2.acme.dev",
          model,
        },
        { variant: variant.key }
      ),
    }));

  return (
    <div className="not-prose flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={modelId}>model</Label>
          <NativeSelect
            id={modelId}
            onChange={(event) => setModel(event.target.value as Model)}
            value={model}
          >
            {MODELS.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {option}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={scenarioId}>Scenario</Label>
          <NativeSelect
            id={scenarioId}
            onChange={(event) => setScenario(event.target.value)}
            value={scenario}
          >
            {scenarios.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <CodeVariants items={items} key={scenario} />
    </div>
  );
};
