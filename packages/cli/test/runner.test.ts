import os from "node:os";

import {
  defineCommand,
  definePrompt,
  defineSnippet,
  p,
  skip,
} from "@copybook/core";
import { describe, expect, it } from "vitest";

import { defineFixture, defineTest } from "../src/test/define";
import { buildPlan } from "../src/test/plan";
import { toJUnit } from "../src/test/reporters";
import { runTests } from "../src/test/runner";
import { checkSyntax } from "../src/test/syntax";

const loaded = (
  definition: Parameters<typeof buildPlan>[0][number]["definition"]
) => ({
  definition,
  exportName: "x",
  file: "x.ts",
});

const run = (cases: Parameters<typeof runTests>[0]) =>
  runTests(cases, { concurrency: 2, root: os.tmpdir(), runId: "test" });

describe(buildPlan, () => {
  const snippet = defineSnippet({
    dimensions: {
      lang: [
        { label: "TS", value: "ts" },
        { label: "Env", value: "env" },
      ],
    },
    id: "plan.snippet",
    variants: [
      {
        code: "const a = 1;",
        lang: "ts",
        verify: "typecheck",
        when: { lang: "ts" },
      },
      { code: "A=1", lang: "dotenv", verify: "run", when: { lang: "env" } },
    ],
  });

  it("caps tiers by verify level and language", () => {
    const plan = buildPlan(
      [loaded(snippet)],
      [],
      ["syntax", "typecheck", "run"]
    );

    expect(
      plan.map((testCase) => `${testCase.variant} ${testCase.tier}`)
    ).toStrictEqual([
      "lang=ts syntax",
      "lang=ts typecheck",
      // dotenv can't be typechecked or run
      "lang=env syntax",
    ]);
  });

  it("skips with the reason from skip()", () => {
    const login = defineCommand({
      id: "plan.login",
      template: () => "acme login",
      verify: skip("interactive"),
    });

    expect(buildPlan([loaded(login)], [])).toMatchObject([
      { skip: "interactive", tier: "syntax" },
    ]);
  });

  it("syntax-checks literal commands in prompts", () => {
    const prompt = definePrompt({
      id: "plan.prompt",
      template: (t) => t`Run ${t.cmd("npm run build")}.`,
    });

    expect(buildPlan([loaded(prompt)], [])).toMatchObject([
      { label: "cmd 1", text: "npm run build", tier: "syntax" },
    ]);
  });

  it("syntax-checks literal shell code blocks in prompts", () => {
    const fromTemplate = definePrompt({
      id: "plan.template",
      template: (t) => t`
        Run:
        ${t.code("bash", "npm install\nnpm run build")}
        Then add ${t.code("ts", "export const a = 1;")}
      `,
    });
    const fromMarkdown = definePrompt({
      id: "plan.markdown",
      markdown: "1. Install:\n\n    ```sh\n    acme init\n    ```\n",
    });

    expect(
      buildPlan([loaded(fromTemplate), loaded(fromMarkdown)], [])
    ).toMatchObject([
      {
        id: "plan.template",
        label: "code block 1",
        lang: "bash",
        text: "npm install\nnpm run build",
        tier: "syntax",
      },
      {
        id: "plan.markdown",
        label: "code block 1",
        lang: "sh",
        text: "acme init",
        tier: "syntax",
      },
    ]);
  });
});

describe("prompt checks", () => {
  it("reads placeholders such as <agent> as words", async () => {
    const prompt = definePrompt({
      id: "plan.placeholder",
      markdown: "```bash\nneon skills -y --global --agent <agent>\n```\n",
    });
    const [check] = buildPlan([loaded(prompt)], []);

    expect(check?.text).toBe("neon skills -y --global --agent agent");
    await expect(
      checkSyntax("bash", check?.text ?? "", os.tmpdir())
    ).resolves.toStrictEqual({ status: "pass" });
  });

  it("checks an included prompt once, under its own id", () => {
    const shared = definePrompt({
      id: "plan.shared",
      template: (t) => t`Install: ${t.code("bash", "npm install acme")}`,
    });
    const page = definePrompt({
      id: "plan.page",
      template: (t) => t`Set up. ${t.include(shared)}`,
    });

    expect(
      buildPlan([loaded(shared), loaded(page)], []).map((check) => check.id)
    ).toStrictEqual(["plan.shared"]);
  });

  it("checks a command inside a shell block with the block", () => {
    const prompt = definePrompt({
      id: "plan.nested",
      template: (t) =>
        t`Run ${t.code("bash", t`${t.cmd("npm run build")}`)} and ${t.cmd("npm run build")}.`,
    });

    expect(
      buildPlan([loaded(prompt)], []).map((check) => check.label)
    ).toStrictEqual(["code block 1"]);
  });

  it("checks shell blocks in Markdown with Windows line endings", () => {
    const prompt = definePrompt({
      id: "plan.crlf",
      markdown: "Run:\r\n\r\n```sh\r\nacme init\r\n```\r\n",
    });

    expect(buildPlan([loaded(prompt)], [])).toMatchObject([
      { label: "code block 1", lang: "sh", text: "acme init" },
    ]);
  });
});

describe(checkSyntax, () => {
  it("catches broken shell, dotenv, TypeScript, and JSON", async () => {
    const results = await Promise.all([
      checkSyntax("bash", "echo 'unterminated", os.tmpdir()),
      checkSyntax("dotenv", "NOT A LINE", os.tmpdir()),
      checkSyntax("ts", "const = 1;", os.tmpdir()),
      checkSyntax("json", "{", os.tmpdir()),
    ]);

    expect(results.map((result) => result.status)).toStrictEqual([
      "fail",
      "fail",
      "fail",
      "fail",
    ]);
  });

  it("passes valid code and skips unknown languages", async () => {
    const results = await Promise.all([
      checkSyntax("bash", "echo ok", os.tmpdir()),
      checkSyntax("dotenv", '# comment\nexport A="1"\nB=2', os.tmpdir()),
      checkSyntax("rust", "fn main() {}", os.tmpdir()),
    ]);

    expect(results).toStrictEqual([
      { status: "pass" },
      { status: "pass" },
      { reason: 'no syntax checker for "rust"', status: "skip" },
    ]);
  });
});

describe(runTests, () => {
  const greeting = defineCommand({
    id: "run.greet",
    params: {
      name: p.string().example("world"),
      token: p.secret({ placeholder: "<token>" }),
    },
    template: (t, { name, token }) =>
      t`echo "hello ${name}" && echo "token ${token}"`,
    verify: "run",
  });

  it("runs with fixture values, tears fixtures down, and redacts secrets", async () => {
    const events: string[] = [];
    const fixture = defineFixture({
      id: "run.fixture",
      setup: () => {
        events.push("setup");
        return Promise.resolve({
          teardown: () => {
            events.push("teardown");
          },
          value: "fixture",
        });
      },
    });
    const spec = defineTest(greeting, {
      expect: { stdout: "hello fixture" },
      fixture,
      params: (value) => ({ name: value, token: "sk-secret" }),
    });
    const [plan] = buildPlan([loaded(greeting)], [spec], ["run"]);
    const report = await run(plan ? [plan] : []);

    expect(report.results).toMatchObject([{ status: "pass", tier: "run" }]);
    expect(events).toStrictEqual(["setup", "teardown"]);
  });

  it("fails on unmet expectations, without leaking secrets", async () => {
    const spec = defineTest(greeting, {
      expect: { stdout: "goodbye" },
      params: () => ({ token: "sk-secret" }),
    });
    const [plan] = buildPlan([loaded(greeting)], [spec], ["run"]);
    const report = await run(plan ? [plan] : []);
    const [result] = report.results;

    expect(result?.status).toBe("fail");
    expect(result?.message).toContain("token [redacted]");
    expect(result?.message).not.toContain("sk-secret");
  });

  it("skips runs whose secrets have no value", async () => {
    const [plan] = buildPlan([loaded(greeting)], [], ["run"]);
    const report = await run(plan ? [plan] : []);

    expect(report.results[0]).toMatchObject({ status: "skip" });
  });
});

describe(toJUnit, () => {
  it("escapes messages", () => {
    const xml = toJUnit({
      finishedAt: "",
      results: [
        { durationMs: 5, id: "a", status: "pass", tier: "syntax" },
        {
          durationMs: 7,
          id: "b",
          message: 'bad <"&">',
          status: "fail",
          tier: "run",
          variant: "x=1",
        },
      ],
      runId: "r",
      startedAt: "",
      tiers: ["syntax", "run"],
    });

    expect(xml).toContain(
      '<testcase classname="b" name="run x=1" time="0.007">'
    );
    expect(xml).toContain('<failure message="bad &lt;&quot;&amp;&quot;&gt;">');
  });
});
