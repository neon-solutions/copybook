import { colors as pc } from "../output";
import type { TestReport, TestResult } from "./types";

const ICONS = {
  fail: pc.red("✗"),
  pass: pc.green("✓"),
  skip: pc.dim("○"),
} as const;

const describeCase = (result: TestResult) =>
  [result.id, result.variant ?? result.label].filter(Boolean).join(" ");

export const formatResult = (result: TestResult) => {
  const name = `${describeCase(result)} ${pc.dim(`${result.tier} · ${result.durationMs}ms`)}`;
  const line = `${ICONS[result.status]} ${name}`;
  if (!result.message) {
    return line;
  }
  const detail = result.message
    .split("\n")
    .map((text) => `    ${text}`)
    .join("\n");
  return `${line}\n${result.status === "fail" ? pc.red(detail) : pc.dim(detail)}`;
};

export const summarize = (report: TestReport) => {
  const count = (status: TestResult["status"]) =>
    report.results.filter((result) => result.status === status).length;
  const parts = [
    pc.green(`${count("pass")} passed`),
    count("fail") > 0 ? pc.red(`${count("fail")} failed`) : undefined,
    count("skip") > 0 ? pc.dim(`${count("skip")} skipped`) : undefined,
  ].filter(Boolean);
  return parts.join(", ");
};

const escapeXml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const seconds = (ms: number) => (ms / 1000).toFixed(3);

/** JUnit XML, for CI test summaries. */
export const toJUnit = (report: TestReport) => {
  const failures = report.results.filter(
    (result) => result.status === "fail"
  ).length;
  const skipped = report.results.filter(
    (result) => result.status === "skip"
  ).length;
  const total = report.results.reduce(
    (sum, result) => sum + result.durationMs,
    0
  );
  const cases = report.results.map((result) => {
    const name = escapeXml(
      [result.tier, result.variant ?? result.label].filter(Boolean).join(" ")
    );
    const open = `    <testcase classname="${escapeXml(result.id)}" name="${name}" time="${seconds(result.durationMs)}"`;
    if (result.status === "pass") {
      return `${open} />`;
    }
    const message = escapeXml(result.message ?? "");
    const body =
      result.status === "skip"
        ? `<skipped message="${message}" />`
        : `<failure message="${escapeXml((result.message ?? "").split("\n")[0] ?? "")}">${message}</failure>`;
    return `${open}>\n      ${body}\n    </testcase>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites tests="${report.results.length}" failures="${failures}" skipped="${skipped}" time="${seconds(total)}">`,
    `  <testsuite name="copybook" tests="${report.results.length}" failures="${failures}" skipped="${skipped}" time="${seconds(total)}">`,
    ...cases,
    "  </testsuite>",
    "</testsuites>",
    "",
  ].join("\n");
};
