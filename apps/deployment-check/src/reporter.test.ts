import type { FullResult, TestCase, TestResult } from "@playwright/test/reporter";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ConsoleReporter from "./reporter.ts";

let output: string;

beforeEach(() => {
  output = "";
  process.env.FORMBRICKS_API_KEY = "fbk_secret";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    output += String(chunk);
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.FORMBRICKS_API_KEY;
});

const testCase = (title: string, annotations: { type: string; description?: string }[] = []) =>
  ({ titlePath: () => ["", "chromium", "01-infra.spec.ts", title], annotations }) as unknown as TestCase;
const result = (status: TestResult["status"], message?: string) =>
  ({ status, error: message ? { message } : undefined }) as unknown as TestResult;
const end = (status: FullResult["status"] = "passed") => ({ status }) as FullResult;

describe("ConsoleReporter", () => {
  test("prints one icon line per check", () => {
    const reporter = new ConsoleReporter();
    reporter.onTestEnd(testCase("ok"), result("passed"));
    reporter.onTestEnd(testCase("bad"), result("failed", "Redis: down. Next step: fix"));
    reporter.onTestEnd(
      testCase("skip", [{ type: "skip", description: "skipped: infra failed" }]),
      result("skipped")
    );

    expect(output).toContain("✅ 01-infra.spec.ts › ok");
    expect(output).toContain("❌ 01-infra.spec.ts › bad\n     Redis: down. Next step: fix");
    expect(output).toContain("⏭  01-infra.spec.ts › skip — skipped: infra failed");
  });

  test("redacts the API key from a failure message", () => {
    const reporter = new ConsoleReporter();
    reporter.onTestEnd(testCase("bad"), result("failed", "request with fbk_secret failed"));

    expect(output).toContain("request with [redacted] failed");
    expect(output).not.toContain("fbk_secret");
  });

  test("strips terminal colour codes from a message", () => {
    const reporter = new ConsoleReporter();
    reporter.onTestEnd(testCase("bad"), result("failed", "\u001b[31mred\u001b[0m"));

    expect(output).toContain("     red\n");
  });

  test("passes when something ran and nothing failed", () => {
    const reporter = new ConsoleReporter();
    reporter.onTestEnd(testCase("ok"), result("passed"));
    reporter.onEnd(end());

    expect(output).toContain("PASSED: 1 passed, 0 failed, 0 skipped");
  });

  test("a run that executed nothing is FAILED, never a healthy deployment", () => {
    const reporter = new ConsoleReporter();
    reporter.onEnd(end());

    expect(output).toContain("FAILED: 0 passed, 0 failed, 0 skipped");
  });

  test("a run with only skips is FAILED too", () => {
    const reporter = new ConsoleReporter();
    reporter.onTestEnd(testCase("skip"), result("skipped"));
    reporter.onEnd(end());

    expect(output).toContain("FAILED: 0 passed, 0 failed, 1 skipped");
  });

  test("any failure, or an interrupted run, is FAILED", () => {
    const failed = new ConsoleReporter();
    failed.onTestEnd(testCase("ok"), result("passed"));
    failed.onTestEnd(testCase("bad"), result("failed", "x"));
    failed.onEnd(end("failed"));
    expect(output).toContain("FAILED: 1 passed, 1 failed");

    output = "";
    const interrupted = new ConsoleReporter();
    interrupted.onTestEnd(testCase("ok"), result("passed"));
    interrupted.onEnd(end("interrupted"));
    expect(output).toContain("FAILED:");
  });

  test("prints a suite load error instead of swallowing it", () => {
    new ConsoleReporter().onError({ message: "First argument must use the object destructuring pattern" });

    expect(output).toContain("❌ First argument must use the object destructuring pattern");
  });
});
