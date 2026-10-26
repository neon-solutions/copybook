import {
  defineCommand,
  definePrompt,
  defineSnippet,
  p,
  skip,
} from "../src/index";

export const install = defineCommand({
  id: "acme.install",
  template: (t) => t`npm i -g acme@latest`,
});

export const login = defineCommand({
  id: "acme.login",
  template: (t) => t`acme login`,
  verify: skip("interactive: opens a browser"),
});

export const init = defineCommand({
  id: "acme.init",
  params: {
    branch: p.string().default("production"),
    orgId: p.string().example("org-example"),
    projectId: p.string().example("proj-example"),
  },
  template: (t, { branch, orgId, projectId }) =>
    t`acme init -y --org-id ${orgId} --project-id ${projectId} --branch ${branch}`,
});

export const client = defineSnippet({
  dimensions: {
    framework: { "ai-sdk": "AI SDK", curl: "cURL", python: "Python" },
  },
  id: "acme.gateway.chat",
  params: {
    model: p
      .enum(["claude-haiku-5-5", "gpt-5-mini"])
      .example("claude-haiku-5-5"),
    token: p.secret({ env: "ACME_TOKEN", placeholder: "<your-token>" }),
  },
  placements: ["console/gateway/model"],
  variants: [
    {
      deps: { npm: ["ai"] },
      lang: "ts",
      template: (t, { model }) => t`
        import { generateText } from "ai";

        const { text } = await generateText({
          model: acme("${model}"),
          prompt: "Explain serverless Postgres.",
        });
      `,
      when: { framework: "ai-sdk" },
    },
    {
      lang: "bash",
      template: (t, { model, token }) => t`
        curl https://gateway.acme.dev/v1/chat \
          -H "Authorization: Bearer ${token}" \
          -d '{"model": "${model}"}'
      `,
      when: { framework: "curl" },
    },
  ],
});

export const getStarted = definePrompt({
  id: "console.create-project.agent",
  params: {
    orgId: p.string().example("org-example"),
    projectId: p.string().example("proj-example"),
  },
  placements: ["console/create-project"],
  template: (t, params) => t`
    Set up this app on Acme.
    1. ${t.cmd(install)}. If that fails, use \`npx acme@latest\`.
    2. In the project root:
       ${t.cmd(init, params)}
    3. Call the gateway:
       ${t.code(client, { model: "claude-haiku-5-5" }, { variant: { framework: "ai-sdk" } })}
  `,
});
