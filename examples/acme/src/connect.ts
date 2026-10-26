import { defineSnippet, p } from "@prompt-manager/core";

import { deploy } from "./commands";
import { endpoint } from "./params";

/**
 * The "Connect to your branch" dialog: one tab per service, each with an
 * `.env` and an `acme.ts + cli` setup.
 */
export const connect = defineSnippet({
  dimensions: {
    service: [
      { label: "Postgres database", value: "postgres" },
      { label: "Storage", value: "storage" },
      { label: "AI Gateway", value: "ai-gateway" },
    ],
    setup: [
      { label: ".env", value: "env" },
      { label: "acme.ts + cli", value: "config" },
    ],
  },
  id: "console.connect.branch",
  params: {
    databaseUrl: p.secret({
      env: "ACME_DATABASE_URL",
      placeholder:
        "postgresql://user:<password>@ep-example.us-east-2.acme.dev/app",
    }),
    endpoint,
    token: p.secret({
      env: "ACME_AI_GATEWAY_TOKEN",
      placeholder: "<your-generated-credential>",
    }),
  },
  placements: ["console/branch/connect-dialog"],
  title: "Connect to your branch",
  variants: [
    {
      lang: "dotenv",
      template: (t, { databaseUrl }) => t`
        # Add this to your .env file
        DATABASE_URL="${databaseUrl}"
      `,
      when: { service: "postgres", setup: "env" },
    },
    {
      lang: "ts",
      template: (t) => t`
        // Create an acme.ts file in your project repo, then run \`${t.cmd(deploy)}\`
        // to provision the database and populate your app's .env file.
        import { defineConfig } from "acme";

        export default defineConfig({ services: { postgres: {} } });
      `,
      when: { service: "postgres", setup: "config" },
    },
    {
      lang: "dotenv",
      template: (t, { endpoint: url }) => t`
        # Add this to your .env file
        ACME_STORAGE_URL="${url}/storage"
      `,
      when: { service: "storage", setup: "env" },
    },
    {
      lang: "dotenv",
      template: (t, { endpoint: url, token }) => t`
        # Add these variables to your .env file
        ACME_AI_GATEWAY_BASE_URL="${url}"
        ACME_AI_GATEWAY_TOKEN="${token}"
      `,
      when: { service: "ai-gateway", setup: "env" },
    },
    {
      deps: { npm: ["openai"] },
      lang: "ts",
      template: (t) => t`
        // Create an acme.ts file in your project repo, then run \`${t.cmd(deploy)}\`
        // to generate credentials and populate your app's .env file.
        import OpenAI from "openai";

        export const acme = new OpenAI({
          baseURL: \`\${process.env.ACME_AI_GATEWAY_BASE_URL}/v1\`,
          apiKey: process.env.ACME_AI_GATEWAY_TOKEN,
        });
      `,
      verify: "typecheck",
      when: { service: "ai-gateway", setup: "config" },
    },
  ],
});
