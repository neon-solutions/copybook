"use client";

import { listVariants, render } from "@copybook/core";
import { connect } from "@copybook/example-acme/connect";
import { useState } from "react";

import { CodeVariants } from "@/components/copybook/code-variants";
import { ParamField } from "@/components/docs/param-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const services = connect.dimensions.service ?? [];
const setups = connect.dimensions.setup ?? [];

const setupLabel = (value: string | undefined) =>
  setups.find((setup) => setup.value === value)?.label ?? value ?? "";

/** The Acme "Connect to your branch" dialog: services × setups. */
export const ConnectDialogDemo = () => {
  const [endpoint, setEndpoint] = useState(
    "https://br-fancy-king-a1b2c3d4.us-east-2.acme.dev"
  );
  const variants = listVariants(connect);

  return (
    <div className="not-prose flex flex-col gap-4">
      <ParamField label="endpoint" onChange={setEndpoint} value={endpoint} />
      <Tabs defaultValue={services[0]?.value}>
        <TabsList variant="line">
          {services.map((service) => (
            <TabsTrigger key={service.value} value={service.value}>
              {service.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {services.map((service) => (
          <TabsContent key={service.value} value={service.value}>
            <CodeVariants
              items={variants
                .filter((variant) => variant.when.service === service.value)
                .map((variant) => ({
                  key: variant.key,
                  label: setupLabel(variant.when.setup),
                  rendered: render(
                    connect,
                    { endpoint },
                    { variant: variant.key }
                  ),
                }))}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
