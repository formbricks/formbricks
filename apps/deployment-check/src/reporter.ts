import type { FullResult, Reporter, TestCase, TestError, TestResult } from "@playwright/test/reporter";
import { redact } from "./config.ts";

// eslint-disable-next-line no-control-regex -- strips terminal colour codes from Playwright messages
const ANSI = /\u001b\[[0-9;]*m/g;

const ICONS = { passed: "✅", failed: "❌", timedOut: "❌", interrupted: "❌", skipped: "⏭ " } as const;

/** One line per check, so an operator can read a deployment's state at a glance. */
export default class ConsoleReporter implements Reporter {
  private counts = { passed: 0, failed: 0, skipped: 0 };
  private readonly apiKey = process.env.FORMBRICKS_API_KEY ?? "";

  private clean(text: string): string {
    return redact(text.replace(ANSI, ""), { apiKey: this.apiKey });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const title = test.titlePath().slice(2).join(" › ");
    const icon = ICONS[result.status];
    let detail = "";

    if (result.status === "skipped") {
      this.counts.skipped++;
      const reason = test.annotations.find((annotation) => annotation.type === "skip")?.description;
      detail = reason ? ` — ${reason}` : "";
    } else if (result.status === "passed") {
      this.counts.passed++;
    } else {
      this.counts.failed++;
      const message = result.error?.message ?? result.status;
      detail = `\n     ${this.clean(message).split("\n")[0]}`;
    }

    process.stdout.write(`${icon} ${title}${detail}\n`);
  }

  onError(error: TestError): void {
    process.stdout.write(`❌ ${this.clean(error.message ?? "unknown error").split("\n")[0]}\n`);
  }

  onEnd(result: FullResult): void {
    const { passed, failed, skipped } = this.counts;
    // A run that executed nothing proves nothing: a broken suite must not read as a healthy deployment.
    const verdict = result.status === "passed" && passed + failed > 0 ? "PASSED" : "FAILED";
    process.stdout.write(`\n${verdict}: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  }
}
