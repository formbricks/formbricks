import { type IntervalHistogram, monitorEventLoopDelay } from "node:perf_hooks";
import { describe, expect, test, vi } from "vitest";
import { loadQsfFixture } from "./__fixtures__/load-fixture";
import { loadRecordedPlan, recordedGenerate, refsInPrompt } from "./__fixtures__/recorded-plans";
import type { TQsfPlanGenerate } from "./ai-plan";
import { checkQsfDraft } from "./final-gate";
import { QSF_DRAFT_MAX_BYTES, measureQsfDraftBytes } from "./fit-draft";
import { normalizeQualtricsLanguageCode } from "./language-codes";
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
  test("prepareQsfImport never scans a 15 MB text for piped text", async () => {
    // One question text of `${e://` repeated, no closing brace: every match attempt used to scan up to
    // 200 characters on, about 1.7 s for the whole text.
    const qsf = {
      SurveyEntry: { SurveyName: "Long text", SurveyLanguage: "EN" },
      SurveyElements: [
        {
          Element: "SQ",
          PrimaryAttribute: "QID1",
          Payload: { QuestionText: "${e://".repeat(2_500_000), QuestionType: "TE", Selector: "SL" },
        },
        {
          Element: "BL",
          Payload: [{ ID: "BL_1", BlockElements: [{ Type: "Question", QuestionID: "QID1" }] }],
        },
        { Element: "FL", Payload: { Flow: [{ Type: "Block", ID: "BL_1" }] } },
      ],
    };

    expect(await maxBlockMs(() => prepareQsfImport(qsf, "long-text.qsf"))).toBeLessThanOrEqual(50);
  });

  test("prepareQsfImport cuts every other long string from the file before it trims or matches it", async () => {
    // Names cut before they are trimmed; codes, numbers, a message reference and a URL refused by
    // their length first.
    const pad = " ".repeat(3_000_000);
    const qsf = {
      SurveyEntry: { SurveyName: `Name${pad}`, SurveyLanguage: `${pad}EN` },
      SurveyElements: [
        {
          Element: "SQ",
          PrimaryAttribute: "QID1",
          Payload: {
            QuestionText: "Q",
            DataExportTag: `Q1${pad}`,
            QuestionType: "TE",
            Selector: "SL",
            Language: { [`${pad}DE`]: { QuestionText: "F" } },
          },
        },
        {
          Element: "BL",
          Payload: [{ ID: "BL_1", BlockElements: [{ Type: "Question", QuestionID: "QID1" }] }],
        },
        {
          Element: "FL",
          Payload: {
            Flow: [
              { Type: "EmbeddedData", EmbeddedData: [{ Field: `f${pad}` }] },
              { Type: "Block", ID: "BL_1" },
            ],
          },
        },
        { Element: "SO", Payload: { EOSMessage: `MS_${"a".repeat(3_000_000)}`, EOSRedirectURL: `${pad}x` } },
      ],
    };

    expect(await maxBlockMs(() => prepareQsfImport(qsf, "long-strings.qsf"))).toBeLessThanOrEqual(50);
  });

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

// Here rather than beside the other pipeline tests: these build and assemble multi-megabyte surveys,
// and a file's tests run one after another, so they never load the machine while an event-loop
// measurement above runs.
describe("a draft too large for the create's request body", () => {
  /** 49 Qualtrics codes for distinct survey languages, from what the reader makes of them. */
  const translationCodes = (): string[] => {
    const seen = new Map<string, string>();
    for (const region of ["", "-AT", "-CH", "-BE", "-US", "-GB"]) {
      for (const code of [
        "AR",
        "BG",
        "CS",
        "DA",
        "DE",
        "EL",
        "ES",
        "ET",
        "FI",
        "FR",
        "HE",
        "HI",
        "HR",
        "HU",
      ]) {
        const normalized = normalizeQualtricsLanguageCode(`${code}${region}`);
        if (normalized && normalized !== "en-US" && !seen.has(normalized))
          seen.set(normalized, `${code}${region}`);
      }
    }
    return [...seen.values()].slice(0, 49);
  };

  /** `questions` multiple choice questions of `options` options, on pages of 10, in `languages`. */
  const buildQsf = (shape: {
    questions: number;
    options: number;
    languages: string[];
    textChars: number;
  }) => {
    const pad = "x".repeat(shape.textChars);
    const refs = Array.from({ length: shape.questions }, (_, q) => `QID${q + 1}`);
    const elements = refs.map((ref, q) => {
      const choices = Object.fromEntries(
        Array.from({ length: shape.options }, (_, i) => [
          String(i + 1),
          { Display: `Option ${i + 1} of ${q}` },
        ])
      );
      const language = Object.fromEntries(
        shape.languages.map((code) => [
          code,
          { QuestionText: `${code} question ${q} ${pad}`, Choices: choices },
        ])
      );
      return {
        Element: "SQ",
        PrimaryAttribute: ref,
        Payload: {
          QuestionText: `Question ${q} ${pad}`,
          DataExportTag: `Q${q + 1}`,
          QuestionType: "MC",
          Selector: "SAVR",
          Choices: choices,
          Language: language,
        },
      };
    });
    const blocks = Array.from({ length: Math.ceil(shape.questions / 10) }, (_, b) => ({
      ID: `BL_${b}`,
      Description: `Block ${b}`,
      BlockElements: refs.slice(b * 10, b * 10 + 10).map((ref) => ({ Type: "Question", QuestionID: ref })),
    }));
    return {
      SurveyEntry: { SurveyName: "Large", SurveyLanguage: "EN" },
      SurveyElements: [
        ...elements,
        { Element: "BL", Payload: blocks },
        { Element: "FL", Payload: { Flow: blocks.map((block) => ({ Type: "Block", ID: block.ID })) } },
      ],
    };
  };

  const answerAsMultipleChoice: TQsfPlanGenerate = async (request) => ({
    object: {
      questions: refsInPrompt(request.prompt).map((ref) => ({
        ref,
        type: "multipleChoiceSingle",
        required: false,
        choicesFrom: "choices",
        rowsFrom: null,
        columnsFrom: null,
        otherChoiceKey: null,
        noneChoiceKey: null,
        labelKey: null,
        excludedKeys: [],
        contactFields: [],
        inputType: null,
        scale: null,
        range: null,
        format: null,
        logicNotes: [],
      })),
      skipped: [],
      pages: [],
    },
  });

  const runQsf = (qsf: Record<string, unknown>) =>
    runQsfImport({
      prepared: prepareQsfImport(qsf, "large.qsf"),
      workspaceId: "clxx1234567890123456789012",
      organizationId: "org_1",
      userId: "user_1",
      signal: new AbortController().signal,
      deadlineMs: 120_000,
      onProgress: () => undefined,
      generate: answerAsMultipleChoice,
    });

  test(
    "cuts languages, last declared first, from 200 questions of 15 options in 50 languages",
    { timeout: 120_000 },
    async () => {
      const result = await runQsf(
        buildQsf({ questions: 200, options: 15, languages: translationCodes(), textChars: 0 })
      );

      expect(measureQsfDraftBytes(result.payload)).toBeLessThanOrEqual(QSF_DRAFT_MAX_BYTES);
      expect(result.report.summary.questions).toBe(200);
      const cut = result.report.issues.filter(
        (issue) => issue.code === "language_skipped" && issue.params?.cause === "draft_too_large"
      );
      expect(cut.length).toBeGreaterThan(0);
      expect(result.report.summary.languages).toHaveLength(50 - cut.length);
      expect(result.report.summary.languages[0]).toBe("en-US");
      expect(cut.map((issue) => issue.params?.code)).not.toContain("en-US");
      expect(checkQsfDraft(result.payload)).toEqual([]);
    }
  );

  test(
    "cuts trailing questions from a one-language survey of very long texts",
    { timeout: 60_000 },
    async () => {
      // 200 questions of 20,000-character texts: about 4 MB in one language.
      const result = await runQsf(buildQsf({ questions: 200, options: 2, languages: [], textChars: 20_000 }));

      expect(measureQsfDraftBytes(result.payload)).toBeLessThanOrEqual(QSF_DRAFT_MAX_BYTES);
      const cut = result.report.issues.filter(
        (issue) => issue.code === "question_skipped" && issue.params?.cause === "draft_too_large"
      );
      expect(cut.length).toBeGreaterThan(0);
      expect(result.report.summary.questions).toBe(200 - cut.length);
      expect(cut[0].questionTag).toBe("Q200");
      expect(result.payload.blocks.flatMap((block) => block.elements).at(-1)?.id).toBe(
        `Q${200 - cut.length}`
      );
      expect(checkQsfDraft(result.payload)).toEqual([]);
    }
  );
});
