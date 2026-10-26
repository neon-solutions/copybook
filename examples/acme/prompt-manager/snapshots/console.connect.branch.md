---
id: console.connect.branch
kind: snippet
title: "Connect to your branch"
source: src/connect.ts#connect
placements:
  - console/branch/connect-dialog
params:
  databaseUrl: "postgresql://user:<password>@ep-example.us-east-2.acme.dev/app"
  endpoint: https://br-fancy-king-a1b2c3d4.us-east-2.acme.dev
  token: "<your-generated-credential>"
embeds:
  - acme.cli.deploy
hash: sha256:03d4893c33d8a356
---

## service=postgres;setup=env

```dotenv
# Add this to your .env file
DATABASE_URL="postgresql://user:<password>@ep-example.us-east-2.acme.dev/app"
```

## service=postgres;setup=config

```ts
// Create an acme.ts file in your project repo, then run `acme deploy`
// to provision the database and populate your app's .env file.
import { defineConfig } from "acme";

export default defineConfig({ services: { postgres: {} } });
```

## service=storage;setup=env

```dotenv
# Add this to your .env file
ACME_STORAGE_URL="https://br-fancy-king-a1b2c3d4.us-east-2.acme.dev/storage"
```

## service=ai-gateway;setup=env

```dotenv
# Add these variables to your .env file
ACME_AI_GATEWAY_BASE_URL="https://br-fancy-king-a1b2c3d4.us-east-2.acme.dev"
ACME_AI_GATEWAY_TOKEN="<your-generated-credential>"
```

## service=ai-gateway;setup=config

```ts
// Create an acme.ts file in your project repo, then run `acme deploy`
// to generate credentials and populate your app's .env file.
import OpenAI from "openai";

export const acme = new OpenAI({
  baseURL: `${process.env.ACME_AI_GATEWAY_BASE_URL}/v1`,
  apiKey: process.env.ACME_AI_GATEWAY_TOKEN,
});
```
