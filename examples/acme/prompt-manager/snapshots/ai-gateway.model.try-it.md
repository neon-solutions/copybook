---
id: ai-gateway.model.try-it
kind: snippet
title: "Try it out"
source: src/ai-gateway.ts#tryIt
placements:
  - console/ai-gateway/model
params:
  endpoint: https://br-fancy-king-a1b2c3d4.us-east-2.acme.dev
  model: claude-haiku-5-5
  token: "<your-token>"
embeds: []
hash: sha256:e784efcb6eace32b
---

## framework=ai-sdk;scenario=chat

```ts
import { generateText } from "ai";
import { acme } from "@acme/ai-sdk-provider";

const { text } = await generateText({
  model: acme("claude-haiku-5-5"),
  prompt: "Explain serverless Postgres.",
});

console.log(text);
```

## framework=python;scenario=chat

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url=f"{os.environ['ACME_AI_GATEWAY_BASE_URL']}/v1",
    api_key=os.environ["ACME_AI_GATEWAY_TOKEN"],
)

response = client.chat.completions.create(
    model="claude-haiku-5-5",
    messages=[{"role": "user", "content": "Explain serverless Postgres."}],
)
print(response.choices[0].message.content)
```

## framework=curl;scenario=chat

```bash
curl https://br-fancy-king-a1b2c3d4.us-east-2.acme.dev/v1/chat/completions \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-haiku-5-5", "messages": [{"role": "user", "content": "Explain serverless Postgres."}]}'
```

## framework=ai-sdk;scenario=stream

```ts
import { streamText } from "ai";
import { acme } from "@acme/ai-sdk-provider";

const result = streamText({
  model: acme("claude-haiku-5-5"),
  prompt: "Write a haiku about branching databases.",
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```
