import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { defineFixture, defineTest } from "@prompt-manager/cli";

import { tryIt } from "../src/ai-gateway";

const TOKEN = "test-token";

/** A local stand-in for the AI Gateway, so the cURL snippet can really run. */
export const mockGateway = defineFixture({
  id: "acme.mock-gateway",
  setup: async () => {
    const server = createServer((request, response) => {
      const authorized = request.headers.authorization === `Bearer ${TOKEN}`;
      response.writeHead(authorized ? 200 : 401, {
        "Content-Type": "application/json",
      });
      response.end(
        JSON.stringify(
          authorized
            ? {
                choices: [
                  {
                    message: { content: "Serverless Postgres scales to zero." },
                  },
                ],
              }
            : { error: "unauthorized" }
        )
      );
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    return {
      teardown: () => {
        server.close();
      },
      value: { url: `http://127.0.0.1:${port}` },
    };
  },
});

export const tryItCurl = defineTest(tryIt, {
  expect: { stdout: /scales to zero/u },
  fixture: mockGateway,
  params: (gateway) => ({
    endpoint: gateway.url,
    model: "claude-haiku-5-5",
    token: TOKEN,
  }),
  variants: ["framework=curl;scenario=chat"],
});
