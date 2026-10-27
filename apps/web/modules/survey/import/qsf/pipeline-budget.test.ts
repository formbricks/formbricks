import { describe, expect, test, vi } from "vitest";
import { loadQsfFixture } from "./__fixtures__/load-fixture";
import { buildMatrixHeavyQsf } from "./__fixtures__/matrix-heavy";
import { loadRecordedPlan, recordedGenerate, refsInPrompt } from "./__fixtures__/recorded-plans";
import type { TQsfPlanGenerate } from "./ai-plan";
import { QsfImportFailedError, QsfImportInputError, prepareQsfImport, runQsfImport } from "./pipeline";

const budget = vi.hoisted(() => ({
  estimate: null as number | null,
  noLimits: false,
  coarsest: false,
  maxCallChars: null as number | null,
  maxTotalChars: null as number | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/survey/lib/permission", () => ({ getExternalUrlsPermission: vi.fn(async () => true) }));
// Every part of the prompt is bounded, so no fixture is over the budget at the tightest limits; the
// refusals are reached by making the measurement report one that is.
vi.mock("./prompt", async (importOriginal) => {
  const original = await importOriginal<typeof import("./prompt")>();
  return {
    ...original,
    // Read when a call is made, so a test can shrink one call's or the whole import's allowance.
    get QSF_PROMPT_MAX_CALL_CHARS() {
      return budget.maxCallChars ?? original.QSF_PROMPT_MAX_CALL_CHARS;
    },
    get QSF_PROMPT_MAX_TOTAL_CHARS() {
      return budget.maxTotalChars ?? original.QSF_PROMPT_MAX_TOTAL_CHARS;
    },
    estimateQsfMinimumPromptChars: (...args: Parameters<typeof original.estimateQsfMinimumPromptChars>) =>
      budget.estimate ?? original.estimateQsfMinimumPromptChars(...args),
    chooseQsfPromptLimits: (...args: Parameters<typeof original.chooseQsfPromptLimits>) => {
      if (budget.noLimits) return null;
      return budget.coarsest ? original.QSF_COARSEST_PROMPT_LIMITS : original.chooseQsfPromptLimits(...args);
    },
  };
});

describe("a survey too large for the prompt budget", () => {
  test("is refused by prepareQsfImport with a 422, before the stream opens", () => {
    budget.estimate = Number.MAX_SAFE_INTEGER;

    let error: unknown;
    try {
      prepareQsfImport(loadQsfFixture("simple.qsf"), "simple.qsf");
    } catch (caught) {
      error = caught;
    }
    budget.estimate = null;

    expect(error).toBeInstanceOf(QsfImportInputError);
    // A Qualtrics export past a limit — the prompt's — not an unreadable file.
    expect((error as QsfImportInputError).invalidParams).toEqual([
      expect.objectContaining({ code: "qsf_limit_exceeded", identifier: "prompt_size" }),
    ]);
  });

  test("fails the import before any AI call when no limits fit it", async () => {
    const prepared = prepareQsfImport(loadQsfFixture("simple.qsf"), "simple.qsf");
    budget.noLimits = true;
    const generate = vi.fn<TQsfPlanGenerate>();

    const error = await runQsfImport({
      prepared,
      workspaceId: "clxx1234567890123456789012",
      organizationId: "org_1",
      userId: null,
      signal: new AbortController().signal,
      deadlineMs: 120_000,
      onProgress: () => undefined,
      generate,
    }).catch((caught: unknown) => caught);
    budget.noLimits = false;

    expect(error).toBeInstanceOf(QsfImportFailedError);
    expect((error as QsfImportFailedError).reason).toBe("prompt_budget");
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("the prompt guards on each call", () => {
  const run = (generate: TQsfPlanGenerate) =>
    runQsfImport({
      prepared: prepareQsfImport(loadQsfFixture("large-150.qsf"), "large-150.qsf"),
      workspaceId: "clxx1234567890123456789012",
      organizationId: "org_1",
      userId: null,
      signal: new AbortController().signal,
      deadlineMs: 120_000,
      onProgress: () => undefined,
      generate,
    });

  test("never send a call over the per-call cap: it is split, and a single question too big is dropped", async () => {
    // Smaller than the system prompt alone, so no call can be sent at any size.
    budget.maxCallChars = 3_000;
    const generate = vi.fn<TQsfPlanGenerate>(recordedGenerate(loadRecordedPlan("large-150.qsf")));

    const error = await run(generate).catch((caught: unknown) => caught);
    budget.maxCallChars = null;

    expect(generate).not.toHaveBeenCalled();
    expect((error as QsfImportFailedError).reason).toBe("no_questions");
  });

  test("stop sending once the import's total is spent, dropping what is left as ai_budget", async () => {
    budget.maxTotalChars = 40_000;
    const sizes: number[] = [];
    const recorded = recordedGenerate(loadRecordedPlan("large-150.qsf"));
    const generate: TQsfPlanGenerate = async (request) => {
      sizes.push(request.system.length + request.prompt.length);
      return recorded(request);
    };

    const result = await run(generate);
    budget.maxTotalChars = null;

    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.reduce((total, size) => total + size, 0)).toBeLessThanOrEqual(40_000);
    expect(result.report.issues.some((issue) => issue.params?.cause === "ai_budget")).toBe(true);
    expect(result.report.summary.questions).toBeGreaterThan(0);
  });
});

describe("a large, ordinary survey over the full prompt budget", () => {
  test(
    "imports with its logic described more coarsely instead of being refused",
    { timeout: 60_000 },
    async () => {
      // 200 Likert matrices, 8 statements on 7 points, each behind a two-condition branch and with a
      // two-condition display rule: over the budget at every tier that describes conditions.
      const prepared = prepareQsfImport(buildMatrixHeavyQsf(), "ratings.qsf");
      const prompts: string[] = [];
      const generate: TQsfPlanGenerate = async (request) => {
        prompts.push(request.prompt);
        return {
          object: {
            questions: refsInPrompt(request.prompt).map((ref) => ({
              ref,
              type: "matrix",
              required: false,
              choicesFrom: null,
              rowsFrom: "choices",
              columnsFrom: "answers",
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
        };
      };

      const result = await runQsfImport({
        prepared,
        workspaceId: "clxx1234567890123456789012",
        organizationId: "org_1",
        userId: null,
        signal: new AbortController().signal,
        deadlineMs: 120_000,
        onProgress: () => undefined,
        generate,
      });

      // Every matrix keeps all 8 statements and 7 points: roles map whole lists, whatever the prompt showed.
      expect(result.report.summary.questions).toBe(200);
      expect(result.payload.blocks[0].elements[0]).toMatchObject({ type: "matrix" });
      const matrix = result.payload.blocks[0].elements[0];
      if (matrix.type !== "matrix") throw new Error("type");
      expect([matrix.rows.length, matrix.columns.length]).toEqual([8, 7]);
      // Logic is only counted in the prompt, and every rule is still reported, without a description.
      expect(prompts.some((prompt) => prompt.includes('"conditions"'))).toBe(false);
      expect(
        prompts.every((prompt) => prompt.includes('"moreRules"') && prompt.includes('"moreChoices":4'))
      ).toBe(true);
      const logicLines = result.report.issues.filter((issue) => issue.code === "logic_not_imported");
      expect(logicLines).toHaveLength(2 * 199);
      expect(logicLines.every((issue) => issue.params === undefined)).toBe(true);
    }
  );
});

describe("the coarsest tier", () => {
  test("still shows the model an Other choice past the options it lists, so it is planned as one", async () => {
    const choices = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [
        String(index + 1),
        index === 9
          ? { Display: "Other, please specify", TextEntry: "true" }
          : { Display: `Option ${index + 1}` },
      ])
    );
    const qsf = {
      SurveyEntry: { SurveyName: "Other last", SurveyLanguage: "EN" },
      SurveyElements: [
        {
          Element: "SQ",
          PrimaryAttribute: "QID1",
          Payload: {
            QuestionText: "Where did you hear about us?",
            DataExportTag: "Q1",
            QuestionType: "MC",
            Selector: "SAVR",
            Choices: choices,
            ChoiceOrder: Object.keys(choices),
          },
        },
        {
          Element: "BL",
          Payload: [{ ID: "BL_1", BlockElements: [{ Type: "Question", QuestionID: "QID1" }] }],
        },
        { Element: "FL", Payload: { Flow: [{ Type: "Block", ID: "BL_1" }] } },
      ],
    };
    // A model that names the text-entry choice it is shown as the other choice, as the prompt asks.
    const prompts: string[] = [];
    const generate: TQsfPlanGenerate = async (request) => {
      prompts.push(request.prompt);
      const data = JSON.parse(
        /<qualtrics_questions>\n(.*)\n<\/qualtrics_questions>/s.exec(request.prompt)?.[1] ?? "{}"
      ) as {
        questions: { ref: string; choices?: { key: string; textEntry?: boolean }[] }[];
      };
      return {
        object: {
          questions: data.questions.map((question) => ({
            ref: question.ref,
            type: "multipleChoiceSingle",
            required: false,
            choicesFrom: "choices",
            rowsFrom: null,
            columnsFrom: null,
            otherChoiceKey: question.choices?.find((choice) => choice.textEntry)?.key ?? null,
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
      };
    };
    budget.coarsest = true;

    const result = await runQsfImport({
      prepared: prepareQsfImport(qsf, "other-last.qsf"),
      workspaceId: "clxx1234567890123456789012",
      organizationId: "org_1",
      userId: null,
      signal: new AbortController().signal,
      deadlineMs: 120_000,
      onProgress: () => undefined,
      generate,
    });
    budget.coarsest = false;

    // Four options listed, then the Other one past them; the count covers only what is left out.
    expect(prompts[0]).toContain('"moreChoices":5');
    expect(prompts[0]).toContain('"textEntry":true');
    const element = result.payload.blocks[0].elements[0];
    if (element.type !== "multipleChoiceSingle") throw new Error("type");
    expect(element.choices).toHaveLength(10);
    expect(element.choices.at(-1)).toEqual({ id: "other", label: { "en-US": "Other, please specify" } });
  });
});
