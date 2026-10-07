import { type IntervalHistogram, monitorEventLoopDelay } from "node:perf_hooks";
import { describe, expect, test, vi } from "vitest";
import { loadQsfFixture } from "./__fixtures__/load-fixture";
import { loadRecordedPlan, recordedGenerate } from "./__fixtures__/recorded-plans";
import { prepareQsfImport, runQsfImport } from "./pipeline";

vi.mock("server-only", () => ({}));
vi.mock("@/modules/survey/lib/permission", () => ({ getExternalUrlsPermission: vi.fn(async () => true) }));

/**
 * How long the import holds the event loop on the largest fixture (150 questions). The route runs it
 * on the web server's own thread, so a long synchronous stretch stalls every other request on the pod.
 *
 * The histogram measures between ticks of its own timer, so it gets a tick before the work and one
 * after it; without them a block at either end goes unrecorded.
 */
const maxBlockMs = async (work: () => unknown): Promise<number> => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
  const histogram: IntervalHistogram = monitorEventLoopDelay({ resolution: 1 });
  histogram.enable();
  await tick();
  await work();
  await tick();
  histogram.disable();
  return histogram.max / 1e6;
};

const runLarge = (prepared: ReturnType<typeof prepareQsfImport>) =>
  runQsfImport({
    prepared,
    workspaceId: "clxx1234567890123456789012",
    organizationId: "org_1",
    userId: null,
    signal: new AbortController().signal,
    deadlineMs: 120_000,
    onProgress: () => undefined,
    generate: recordedGenerate(loadRecordedPlan("large-150.qsf")),
  });

describe("event loop", () => {
  test("prepareQsfImport holds it for at most ~50 ms on the largest file, cold", async () => {
    const qsf = loadQsfFixture("large-150.qsf");

    // Measured at about 7 ms cold and 2 ms warm on a laptop; the bound is the plan's budget.
    expect(await maxBlockMs(() => prepareQsfImport(qsf, "large-150.qsf"))).toBeLessThanOrEqual(50);
  });

  test(
    "runQsfImport never holds it for long, sanitizer included, the AI mocked",
    { timeout: 30_000 },
    async () => {
      // A first run pays for JIT and for compiling the survey schemas, once per process.
      await runLarge(prepareQsfImport(loadQsfFixture("large-150.qsf"), "large-150.qsf"));
      const prepared = prepareQsfImport(loadQsfFixture("large-150.qsf"), "large-150.qsf");
      // Every text with real markup, choices included: over half a second of sanitizing in all, in
      // about 600 small texts. It has to come in slices.
      for (const text of prepared.survey.texts.values()) {
        text.byLanguage.set(prepared.survey.defaultLanguage, "<span>x</span>".repeat(30));
      }

      // Measured at about 20 ms warm: the longest stretch is one synchronous check of the draft. The
      // bound is loose for a loaded CI runner, and far under what an unyielding sanitizer blocks for.
      expect(await maxBlockMs(() => runLarge(prepared))).toBeLessThan(250);
    }
  );
});
