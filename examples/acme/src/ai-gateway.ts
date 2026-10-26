import { defineSnippet, p } from "@prompt-manager/core";

import { endpoint } from "./params";

export const MODELS = [
  "claude-haiku-5-5",
  "claude-sonnet-5-5",
  "gpt-5-mini",
] as const;

/**
 * The AI Gateway model page's "Try it out" section. The model is a param, so
 * one definition covers every model page.
 */
export const tryIt = defineSnippet({
  dimensions: {
    framework: [
      { label: "AI SDK", value: "ai-sdk" },
      { label: "Python", value: "python" },
      { label: "cURL", value: "curl" },
    ],
    scenario: [
      { label: "Send a simple chat message", value: "chat" },
      { label: "Stream a response", value: "stream" },
    ],
  },
  id: "ai-gateway.model.try-it",
  params: {
    endpoint,
    model: p.enum(MODELS).example("claude-haiku-5-5"),
    token: p.secret({
      env: "ACME_AI_GATEWAY_TOKEN",
      placeholder: "<your-token>",
    }),
  },
  placements: ["console/ai-gateway/model"],
  title: "Try it out",
  variants: [
    {
      deps: { npm: ["ai", "@acme/ai-sdk-provider"] },
      lang: "ts",
      template: (t, { model }) => t`
        import { generateText } from "ai";
        import { acme } from "@acme/ai-sdk-provider";

        const { text } = await generateText({
          model: acme("${model}"),
          prompt: "Explain serverless Postgres.",
        });

        console.log(text);
      `,
      // @acme/ai-sdk-provider is fictional, so only check the syntax.
      verify: "syntax",
      when: { framework: "ai-sdk", scenario: "chat" },
    },
    {
      deps: { pip: ["openai"] },
      lang: "python",
      template: (t, { model }) => t`
        import os
        from openai import OpenAI

        client = OpenAI(
            base_url=f"{os.environ['ACME_AI_GATEWAY_BASE_URL']}/v1",
            api_key=os.environ["ACME_AI_GATEWAY_TOKEN"],
        )

        response = client.chat.completions.create(
            model="${model}",
            messages=[{"role": "user", "content": "Explain serverless Postgres."}],
        )
        print(response.choices[0].message.content)
      `,
      when: { framework: "python", scenario: "chat" },
    },
    {
      lang: "bash",
      template: (t, { endpoint: url, model, token }) => t`
        curl ${url}/v1/chat/completions \\
          -H "Authorization: Bearer ${token}" \\
          -H "Content-Type: application/json" \\
          -d '{"model": "${model}", "messages": [{"role": "user", "content": "Explain serverless Postgres."}]}'
      `,
      // Runs against a local mock gateway; see verify/gateway.verify.ts.
      verify: "run",
      when: { framework: "curl", scenario: "chat" },
    },
    {
      deps: { npm: ["ai", "@acme/ai-sdk-provider"] },
      lang: "ts",
      template: (t, { model }) => t`
        import { streamText } from "ai";
        import { acme } from "@acme/ai-sdk-provider";

        const result = streamText({
          model: acme("${model}"),
          prompt: "Write a haiku about branching databases.",
        });

        for await (const chunk of result.textStream) {
          process.stdout.write(chunk);
        }
      `,
      verify: "syntax",
      when: { framework: "ai-sdk", scenario: "stream" },
    },
  ],
});
