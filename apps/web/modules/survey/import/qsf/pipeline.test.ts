import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AIOutputTokenLimitError } from "@formbricks/ai";
import { prepareV3SurveyCreateInput } from "@/app/api/v3/surveys/prepare";
import type { TQsfImportReport } from "../types";
import {
  IMPORTABLE_QSF_FIXTURES,
  type TImportableQsfFixture,
  loadQsfFixture,
} from "./__fixtures__/load-fixture";
import { loadRecordedPlan, recordedGenerate, timedGenerate } from "./__fixtures__/recorded-plans";
import type { TQsfPlanGenerate } from "./ai-plan";
import type { TQsfDraftDocument } from "./assemble";
import { checkQsfDraft } from "./final-gate";
import { isObjectMemberName } from "./id-registry";
import {
  QsfImportFailedError,
  QsfImportInputError,
  type TRunQsfImportParams,
  prepareQsfImport,
  runQsfImport,
} from "./pipeline";

const mocks = vi.hoisted(() => ({
  generateOrganizationAIObject: vi.fn(),
  getExternalUrlsPermission: vi.fn(),
  checkQsfDraft: vi.fn(),
  realCheckQsfDraft: undefined as unknown as typeof import("./final-gate").checkQsfDraft,
}));

vi.mock("server-only", () => ({}));
// Only the AI call is replaced; the reader, sanitizer, checks, assembly and the create's own checks run.
vi.mock("@/lib/ai/service", () => ({ generateOrganizationAIObject: mocks.generateOrganizationAIObject }));
vi.mock("@/modules/survey/lib/permission", () => ({
  getExternalUrlsPermission: mocks.getExternalUrlsPermission,
}));
vi.mock("./final-gate", async (importOriginal) => {
  const original = await importOriginal<typeof import("./final-gate")>();
  mocks.realCheckQsfDraft = original.checkQsfDraft;
  return { ...original, checkQsfDraft: mocks.checkQsfDraft };
});

const WORKSPACE_ID = "clxx1234567890123456789012";

const run = (fixture: string, overrides: Partial<TRunQsfImportParams> = {}) =>
  runQsfImport({
    prepared: prepareQsfImport(loadQsfFixture(fixture), fixture),
    workspaceId: WORKSPACE_ID,
    organizationId: "org_1",
    userId: "user_1",
    signal: new AbortController().signal,
    deadlineMs: 120_000,
    onProgress: vi.fn(),
    ...overrides,
  });

/** The organization's model answers from the fixture's recorded plan. */
const answerFrom = (plan: string) => {
  const generate = recordedGenerate(loadRecordedPlan(plan));
  mocks.generateOrganizationAIObject.mockImplementation(generate);
};

const elementsOf = (document: TQsfDraftDocument) => document.blocks.flatMap((block) => block.elements);

type TExpectedReport = [TQsfImportReport["summary"], string[]];

/** What each fixture's import must report: the summary, and the issue codes (with causes), sorted. */
const EXPECTED_REPORTS: Record<TImportableQsfFixture, TExpectedReport> = {
  "simple.qsf": [{ blocks: 1, questions: 5, languages: ["en-US"], logicRules: 0, hiddenFields: 0 }, []],
  "multilang-en-de.qsf": [
    { blocks: 1, questions: 3, languages: ["en-US", "de-DE"], logicRules: 0, hiddenFields: 0 },
    [],
  ],
  "logic-skip-display-branch.qsf": [
    { blocks: 4, questions: 6, languages: ["en-US"], logicRules: 6, hiddenFields: 1 },
    Array(6).fill("logic_not_imported"),
  ],
  "matrix-slider-ranking.qsf": [
    { blocks: 3, questions: 8, languages: ["en-US"], logicRules: 0, hiddenFields: 0 },
    [
      "question_skipped:ai_skipped",
      "question_skipped:ai_skipped",
      "question_skipped:unsupported_type",
      "question_skipped:unsupported_type",
      "question_skipped:unsupported_type",
    ],
  ],
  "pages-and-blocks.qsf": [
    { blocks: 3, questions: 3, languages: ["en-US"], logicRules: 1, hiddenFields: 0 },
    ["logic_not_imported", "question_skipped:not_in_flow"],
  ],
  "embedded-data.qsf": [
    { blocks: 2, questions: 2, languages: ["en-US"], logicRules: 0, hiddenFields: 4 },
    [...Array(4).fill("field_renamed"), "piped_text_removed"],
  ],
  "large-150.qsf": [{ blocks: 30, questions: 150, languages: ["en-US"], logicRules: 0, hiddenFields: 0 }, []],
  "legacy-object-payload.qsf": [
    { blocks: 1, questions: 2, languages: ["de-DE"], logicRules: 0, hiddenFields: 0 },
    [],
  ],
  "nps-and-numeric-scales.qsf": [
    { blocks: 1, questions: 6, languages: ["en-US"], logicRules: 0, hiddenFields: 0 },
    [],
  ],
  "labels-and-languages.qsf": [
    {
      blocks: 2,
      questions: 3,
      languages: ["en-US", "de-DE", "zh-Hans-CN", "zh-Hant-TW"],
      logicRules: 0,
      hiddenFields: 0,
    },
    [
      "choice_label_renamed",
      "choice_label_renamed",
      "language_skipped",
      "translation_fallback",
      "translation_fallback",
    ],
  ],
  "rich-text.qsf": [
    { blocks: 2, questions: 6, languages: ["en-US"], logicRules: 0, hiddenFields: 1 },
    [
      "field_renamed",
      "formatting_dropped",
      "headline_fallback",
      "headline_fallback",
      "image_dropped",
      "image_dropped",
      "image_dropped",
      "markup_escaped",
      "piped_text_removed",
      "script_dropped",
      "script_dropped",
      "text_too_long",
    ],
  ],
  "prompt-injection.qsf": [
    { blocks: 1, questions: 2, languages: ["en-US"], logicRules: 0, hiddenFields: 0 },
    [],
  ],
  "pollution.qsf": [
    { blocks: 2, questions: 4, languages: ["en-US", "de-DE"], logicRules: 0, hiddenFields: 6 },
    [
      "choice_dropped:invalid_id",
      "choice_dropped:invalid_id",
      ...Array(6).fill("field_renamed"),
      "language_skipped",
      "question_skipped:invalid_id",
      "question_skipped:invalid_id",
      "translation_fallback",
    ],
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getExternalUrlsPermission.mockResolvedValue(true);
  mocks.checkQsfDraft.mockImplementation(mocks.realCheckQsfDraft);
});

describe("prepareQsfImport", () => {
  test("reads the file into the import's model", () => {
    const prepared = prepareQsfImport(loadQsfFixture("simple.qsf"), "simple.qsf");

    expect(prepared).toMatchObject({ fileName: "simple.qsf", surveyName: "Customer feedback" });
    expect(prepared.survey.questions.size).toBe(5);
  });

  test("never reads top-level keys it does not use, so a large file is not copied", () => {
    // A key that cannot be read stands in for the rest of a 15 MB file: copying it is what costs.
    const qsf = loadQsfFixture("simple.qsf");
    Object.defineProperty(qsf, "Unused", {
      enumerable: true,
      get: () => {
        throw new Error("an unchecked key was read");
      },
    });

    expect(prepareQsfImport(qsf, "a.qsf").surveyName).toBe("Customer feedback");
  });

  test.each([
    ["any other JSON file", "not-a-qsf.json"],
    ["a flow nested past the cap", "deep-flow.qsf"],
    ["a survey past the question limit", "over-limit.qsf"],
  ])("refuses %s with QsfImportInputError, before any AI", (_case, fixture) => {
    expect(() => prepareQsfImport(loadQsfFixture(fixture), fixture)).toThrow(QsfImportInputError);
  });
});

describe("runQsfImport on recorded plans", () => {
  test.each(IMPORTABLE_QSF_FIXTURES)(
    "%s becomes a draft the create accepts, with its report",
    async (fixture) => {
      answerFrom(fixture);
      const onProgress = vi.fn();

      const result = await run(fixture, { onProgress });

      // The shared create check: v3 validation (recall order enforced) and the survey service's schema.
      expect(checkQsfDraft(result.payload)).toEqual([]);
      // And exactly what POST /api/v3/surveys runs first, on the body the dialog sends.
      expect(prepareV3SurveyCreateInput(JSON.parse(JSON.stringify(result.payload))).ok).toBe(true);

      const [summary, codes] = EXPECTED_REPORTS[fixture];
      expect(result.report.source).toEqual({ kind: "qsf", fileName: fixture });
      expect(result.report.summary).toEqual(summary);
      expect(
        result.report.issues
          .map((issue) => `${issue.code}${issue.params?.cause ? `:${String(issue.params.cause)}` : ""}`)
          .sort()
      ).toEqual(codes);
      expect(onProgress.mock.calls.map(([stage]) => stage)).toEqual(["ai", "assembling"]);
      expect(result.usage?.inputTokens).toBeGreaterThan(0);
      expect(result.usage?.outputTokens).toBeGreaterThan(0);
    },
    30_000
  );

  test("calls the organization's AI with the import's tracing feature", async () => {
    answerFrom("simple.qsf");

    await run("simple.qsf");

    expect(mocks.generateOrganizationAIObject).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        aiTracing: { distinctId: "user_1", feature: "ai_qsf_import", workspaceId: WORKSPACE_ID },
        maxOutputTokens: 8192,
        abortSignal: expect.any(AbortSignal),
      })
    );
  });

  test("the prompt-injection draft carries only text the file wrote, no link and no disallowed type", async () => {
    answerFrom("prompt-injection.qsf");
    const qsf = JSON.stringify(loadQsfFixture("prompt-injection.qsf"));

    const result = await run("prompt-injection.qsf");

    const draft = JSON.stringify(result.payload);
    for (const field of ["buttonUrl", "buttonLink", "imageUrl", "videoUrl", "href", "calUserName", "url"]) {
      expect(draft).not.toContain(`"${field}"`);
    }
    expect(elementsOf(result.payload).map((element) => element.type)).toEqual([
      "multipleChoiceSingle",
      "cta",
    ]);
    for (const element of elementsOf(result.payload)) {
      const texts = [
        ...Object.values(element.headline),
        ...("choices" in element ? element.choices.flatMap((choice) => Object.values(choice.label)) : []),
      ];
      for (const text of texts) expect(qsf).toContain(text);
    }
    // The notes the model wrote, links included, belong to no rule: none reaches the report.
    expect(JSON.stringify(result.report)).not.toContain("evil");
  });

  test("a polluting file leaves Object.prototype alone and names nothing after its members", async () => {
    answerFrom("pollution.qsf");
    const before = Object.getOwnPropertyNames(Object.prototype).sort();

    const result = await run("pollution.qsf");

    expect(Object.getOwnPropertyNames(Object.prototype).sort()).toEqual(before);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const names = [
      ...elementsOf(result.payload).map((element) => element.id),
      ...result.payload.hiddenFields.fieldIds,
      ...result.payload.languages.map((language) => language.code),
      ...elementsOf(result.payload).flatMap((element) => Object.keys(element.headline)),
    ];
    expect(names.filter(isObjectMemberName)).toEqual([]);
  });

  test("retries what a plan got wrong, once, and drops what is still wrong", async () => {
    const hostile = loadRecordedPlan("hostile");
    const recorded = recordedGenerate(loadRecordedPlan("simple.qsf"));
    let calls = 0;
    mocks.generateOrganizationAIObject.mockImplementation(
      async (request: Parameters<TQsfPlanGenerate>[0]) => {
        calls += 1;
        if (calls === 1) return { object: hostile };
        // The retry gets QID1 to QID3 right; QID4 and QID5 stay wrong.
        const fixed = await recorded(request);
        const object = fixed.object as { questions: { ref: string }[] };
        return {
          ...fixed,
          object: {
            ...object,
            questions: object.questions.filter((question) => !["QID4", "QID5"].includes(question.ref)),
          },
        };
      }
    );

    const result = await run("simple.qsf");

    expect(calls).toBe(2);
    expect(elementsOf(result.payload).map((element) => element.id)).toEqual(["Q1", "Q2", "Q3"]);
    expect(result.report.issues).toEqual([
      { code: "question_skipped", severity: "warning", questionTag: "Q4", params: { cause: "plan_invalid" } },
      { code: "question_skipped", severity: "warning", questionTag: "Q5", params: { cause: "plan_invalid" } },
    ]);
  });

  test("a page split across AI calls, or a question only the retry placed, still makes one block", async () => {
    const recorded = recordedGenerate(loadRecordedPlan("simple.qsf"));
    let calls = 0;
    mocks.generateOrganizationAIObject.mockImplementation(
      async (request: Parameters<TQsfPlanGenerate>[0]) => {
        calls += 1;
        // Read before the await: the halves run at the same time.
        const call = calls;
        // The whole page is too long for one call, so it is split in two; the first half then leaves
        // QID2 out, which only the retry places.
        if (call === 1) throw new AIOutputTokenLimitError({ maxOutputTokens: 8192 });
        const result = await recorded(request);
        if (call !== 2) return result;
        const object = result.object as { questions: { ref: string }[] };
        return {
          ...result,
          object: { ...object, questions: object.questions.filter((entry) => entry.ref !== "QID2") },
        };
      }
    );

    const result = await run("simple.qsf");

    expect(calls).toBe(4);
    expect(result.payload.blocks.map((block) => block.elements.map((element) => element.id))).toEqual([
      ["Q1", "Q2", "Q3", "Q4", "Q5"],
    ]);
  });

  test("fails the import when no question survives", async () => {
    mocks.generateOrganizationAIObject.mockResolvedValue({
      object: {
        blocks: [],
        questions: [],
        skipped: ["QID1", "QID2", "QID3", "QID4", "QID5"].map((ref) => ({ ref, reason: "No" })),
      },
    });

    const error = await run("simple.qsf").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(QsfImportFailedError);
    expect((error as QsfImportFailedError).reason).toBe("no_questions");
  });

  test("drops an element the create would refuse, reports it and assembles again", async () => {
    answerFrom("simple.qsf");
    mocks.checkQsfDraft.mockReturnValueOnce([
      { name: "blocks.0.elements.1.headline", reason: "The question is missing" },
    ]);

    const result = await run("simple.qsf");

    expect(elementsOf(result.payload).map((element) => element.id)).toEqual(["Q1", "Q3", "Q4", "Q5"]);
    expect(result.report.issues).toEqual([
      {
        code: "question_skipped",
        severity: "warning",
        questionTag: "Q2",
        params: { cause: "validation_failed" },
      },
    ]);
  });

  test.each([
    ["outside an element", [[{ name: "endings.0.label", reason: "r" }]]],
    [
      "twice",
      [
        [{ name: "blocks.0.elements.1.headline", reason: "r" }],
        [{ name: "blocks.0.elements.0.headline", reason: "r" }],
      ],
    ],
  ])("fails the import when the create would refuse the draft %s", async (_case, failures) => {
    answerFrom("simple.qsf");
    for (const failure of failures) mocks.checkQsfDraft.mockReturnValueOnce(failure);

    const error = await run("simple.qsf").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(QsfImportFailedError);
    expect((error as QsfImportFailedError).reason).toBe("draft_invalid");
  });

  test("asks about external URLs only for a survey with a redirect, and drops the redirect without them", async () => {
    answerFrom("simple.qsf");
    await run("simple.qsf");
    expect(mocks.getExternalUrlsPermission).not.toHaveBeenCalled();

    answerFrom("rich-text.qsf");
    mocks.getExternalUrlsPermission.mockResolvedValue(false);
    const result = await run("rich-text.qsf");

    expect(mocks.getExternalUrlsPermission).toHaveBeenCalledWith("org_1");
    expect(result.payload.endings.map((ending) => ending.type)).toEqual(["endScreen"]);
    expect(result.report.issues).toContainEqual({ code: "external_url_removed", severity: "warning" });
  });

  test("stops at once when the import was aborted before it started", async () => {
    const controller = new AbortController();
    controller.abort();
    const onProgress = vi.fn();

    await expect(run("simple.qsf", { signal: controller.signal, onProgress })).rejects.toThrow();
    expect(onProgress).not.toHaveBeenCalled();
    expect(mocks.generateOrganizationAIObject).not.toHaveBeenCalled();
  });

  test("passes Stop to the AI call and lets its abort through", async () => {
    const controller = new AbortController();
    mocks.generateOrganizationAIObject.mockImplementation(
      (request: Parameters<TQsfPlanGenerate>[0]) =>
        new Promise((_resolve, reject) => {
          request.abortSignal.addEventListener("abort", () => reject(request.abortSignal.reason), {
            once: true,
          });
          controller.abort(new DOMException("Stopped", "AbortError"));
        })
    );

    const error = await run("simple.qsf", { signal: controller.signal }).catch((caught: unknown) => caught);

    expect((error as DOMException).name).toBe("AbortError");
  });

  describe("with a model that takes time", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    test("finishes with a draft when one AI call runs past its own timeout, splitting that chunk", async () => {
      const prepared = prepareQsfImport(loadQsfFixture("large-150.qsf"), "large-150.qsf");
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "performance"] });
      // The first chunk stalls past the 45 s call timeout; its halves and every other call take 20 s.
      mocks.generateOrganizationAIObject.mockImplementation(
        timedGenerate(loadRecordedPlan("large-150.qsf"), (refs) =>
          refs.includes("QID1") && refs.length === 20 ? Infinity : 20_000
        )
      );

      const settled = runQsfImport({
        prepared,
        workspaceId: WORKSPACE_ID,
        organizationId: "org_1",
        userId: "user_1",
        signal: new AbortController().signal,
        deadlineMs: 120_000,
        onProgress: vi.fn(),
      });
      await vi.advanceTimersByTimeAsync(130_000);
      const result = await settled;

      expect(result.report.summary.questions).toBe(150);
      expect(mocks.realCheckQsfDraft(result.payload)).toEqual([]);
      expect(mocks.generateOrganizationAIObject).toHaveBeenCalledTimes(10);
    });
  });
});
