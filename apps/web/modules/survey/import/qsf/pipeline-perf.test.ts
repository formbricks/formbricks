import { type IntervalHistogram, monitorEventLoopDelay } from "node:perf_hooks";
import { describe, expect, test, vi } from "vitest";
import { loadQsfFixture } from "./__fixtures__/load-fixture";
import { loadRecordedPlan, recordedGenerate } from "./__fixtures__/recorded-plans";
import { QsfImportInputError, prepareQsfImport, runQsfImport } from "./pipeline";

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

/**
 * A hostile file: one question with 200 choices and 200 answers, and `variants` `Language` keys that
 * all spell German — `de`, `DE`, ` de`, `\tDe`, … — each with an empty translation of both lists. Case
 * and whitespace variants normalize to one language, so the language cap never fired on them, and
 * every key used to be checked against every choice and answer: ~9 s at 390,000 keys.
 */
function buildLanguageVariantsQsf(variants: number): Record<string, unknown> {
  const options = Object.fromEntries(
    Array.from({ length: 200 }, (_, i) => [String(i + 1), { Display: `Option ${i + 1}` }])
  );
  const language: Record<string, unknown> = {};
  const spellings = ["de", "dE", "De", "DE"];
  const space = [" ", "\t", "\n", "\r"];
  for (let index = 0; index * spellings.length < variants; index++) {
    // `index` in base 4, written in whitespace, before each spelling: every key distinct.
    let prefix = "";
    for (let rest = index; rest > 0; rest = Math.floor(rest / 4)) prefix += space[rest % 4];
    for (const spelling of spellings) language[`${prefix}${spelling}`] = { Choices: {}, Answers: {} };
  }
  return {
    SurveyEntry: { SurveyName: "Variants", SurveyLanguage: "EN" },
    SurveyElements: [
      {
        Element: "SQ",
        PrimaryAttribute: "QID1",
        Payload: {
          QuestionText: "Rate each",
          QuestionType: "Matrix",
          Selector: "Likert",
          Choices: options,
          Answers: options,
          Language: language,
        },
      },
      { Element: "BL", Payload: [{ ID: "BL_1", BlockElements: [{ Type: "Question", QuestionID: "QID1" }] }] },
      { Element: "FL", Payload: { Flow: [{ Type: "Block", ID: "BL_1" }] } },
    ],
  };
}

describe("event loop", () => {
  test("prepareQsfImport refuses a file of Language key variants at once, before reading any key", async () => {
    const qsf = buildLanguageVariantsQsf(20_000);
    let refused: unknown;

    const blockMs = await maxBlockMs(() => {
      try {
        prepareQsfImport(qsf, "variants.qsf");
      } catch (error) {
        refused = error;
      }
    });

    expect(refused).toBeInstanceOf(QsfImportInputError);
    // A count of the keys, natively; reading them against 400 options took about half a second here.
    expect(blockMs).toBeLessThanOrEqual(50);
  });

  test("and holds it for well under a second at 390,000 variants, where it used to take about 9 s", async () => {
    const qsf = buildLanguageVariantsQsf(390_000);
    let refused: unknown;

    const blockMs = await maxBlockMs(() => {
      try {
        prepareQsfImport(qsf, "variants.qsf");
      } catch (error) {
        refused = error;
      }
    });

    expect(refused).toBeInstanceOf(QsfImportInputError);
    // V8 enumerating 390,000 keys once (~80 ms here); the route's JSON.parse of that body takes longer.
    expect(blockMs).toBeLessThanOrEqual(400);
  });

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
