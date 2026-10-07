import { NoObjectGeneratedError } from "ai";
import { describe, expect, test, vi } from "vitest";
import { AIOutputTokenLimitError } from "@formbricks/ai";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { loadQsfFixture } from "./__fixtures__/load-fixture";
import { buildOversizedLogicQsf } from "./__fixtures__/oversized-logic";
import { loadRecordedPlan, recordedGenerate, refsInPrompt } from "./__fixtures__/recorded-plans";
import {
  QSF_AI_CALL_TIMEOUT_MS,
  QSF_CHUNK_OUTPUT_TOKENS,
  QSF_MAX_AI_CALLS,
  QSF_PLAN_MAX_OUTPUT_TOKENS,
  type TQsfPlanGenerate,
  type TQsfPlanRequest,
  chunkQuestions,
  planQsfImport,
} from "./ai-plan";
import { QsfImportTimeoutError } from "./errors";
import {
  QSF_PROMPT_MAX_CALL_CHARS,
  QSF_PROMPT_MAX_TOTAL_CHARS,
  chooseQsfPromptLimits,
  describeQsfQuestions,
} from "./prompt";
import { readQsf } from "./read-qsf";
import { sanitizeQsfTexts } from "./sanitize-text";

const prepare = async (fixture: string) => {
  const survey = readQsf(loadQsfFixture(fixture));
  const texts = await sanitizeQsfTexts(survey, new AbortController().signal);
  return { survey, texts };
};

const plan = async (
  fixture: string,
  generate: TQsfPlanGenerate,
  options: { signal?: AbortSignal; deadlineInMs?: number } = {}
) => {
  const { survey, texts } = await prepare(fixture);
  return planQsfImport({
    survey,
    texts,
    generate,
    signal: options.signal ?? new AbortController().signal,
    deadline: performance.now() + (options.deadlineInMs ?? 120_000),
  });
};

const planSurvey = async (qsf: Record<string, unknown>, generate: TQsfPlanGenerate) => {
  const survey = readQsf(qsf);
  const texts = await sanitizeQsfTexts(survey, new AbortController().signal);
  return planQsfImport({
    survey,
    texts,
    generate,
    signal: new AbortController().signal,
    deadline: performance.now() + 120_000,
  });
};

const tooLong = () => new AIOutputTokenLimitError({ maxOutputTokens: 8192, outputTokens: 8192 });

/** A model that answers every question asked as a two-choice question. */
const answerEverything: TQsfPlanGenerate = async (request) => ({
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

describe("chunkQuestions", () => {
  test("cuts a large survey into chunks of a fixed expected output, as many as it takes", async () => {
    const { survey, texts } = await prepare("large-150.qsf");
    const refs = [...survey.questions.keys()];
    const limits = chooseQsfPromptLimits(survey, refs, texts);
    if (!limits) throw new Error("limits");

    const chunks = chunkQuestions({ survey, texts, limits }, refs);

    // 70 expected tokens a question: 42 to a 3,000-token chunk.
    expect(chunks.map((chunk) => chunk.length)).toEqual([42, 42, 42, 24]);
    expect(chunks.flat()).toEqual(refs);
    expect(QSF_CHUNK_OUTPUT_TOKENS).toBeLessThan(QSF_PLAN_MAX_OUTPUT_TOKENS / 2);
  });
});

describe("chunkQuestions and the per-call prompt cap", () => {
  test("cuts by prompt size too, so no call is too large to send", async () => {
    const { survey, texts } = await prepare("large-150.qsf");
    // 35 questions with 40 long choices each: ~6k characters a question, ~210k in all — within the
    // import's budget at the loosest limits, but not in one call.
    const refs = [...survey.questions.keys()].slice(0, 35);
    const plainDefault = new Map(texts.plainDefault);
    for (const ref of refs) {
      const question = survey.questions.get(ref);
      if (!question) continue;
      question.choices = Array.from({ length: 40 }, (_, index) => {
        const key = `c_${ref}_${index}`;
        plainDefault.set(key, "x".repeat(120));
        return { key, textEntry: false, exclusive: false };
      });
    }
    const wideTexts = { ...texts, plainDefault };
    const limits = chooseQsfPromptLimits(survey, refs, wideTexts);
    if (!limits) throw new Error("limits");

    const chunks = chunkQuestions({ survey, texts: wideTexts, limits }, refs);

    expect(limits.options).toBe(40);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(describeQsfQuestions(survey, chunk, wideTexts, limits).length).toBeLessThanOrEqual(
        QSF_PROMPT_MAX_CALL_CHARS - 20_000
      );
    }
  });
});

describe("planQsfImport", () => {
  test(
    "keeps every call and the whole import under the prompt budget, however large the logic",
    { timeout: 60_000 },
    async () => {
      // 200 questions, each with 21 rules of up to 400 conditions on 200-character values, behind a
      // branch just as large: ~67 MB of logic in memory.
      const survey = readQsf(buildOversizedLogicQsf());
      const texts = await sanitizeQsfTexts(survey, new AbortController().signal);
      const sizes: number[] = [];
      const generate: TQsfPlanGenerate = async (request) => {
        sizes.push(request.system.length + request.prompt.length);
        // Conditions, rules and operands are cut to the tier's bounds.
        expect(request.prompt).not.toContain("v".repeat(61));
        expect(request.prompt).toContain('"moreConditions"');
        return {
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
        };
      };

      const result = await planQsfImport({
        survey,
        texts,
        generate,
        signal: new AbortController().signal,
        deadline: performance.now() + 120_000,
      });

      expect(sizes.length).toBeGreaterThan(0);
      expect(Math.max(...sizes)).toBeLessThanOrEqual(QSF_PROMPT_MAX_CALL_CHARS);
      expect(sizes.reduce((total, size) => total + size, 0)).toBeLessThanOrEqual(QSF_PROMPT_MAX_TOTAL_CHARS);
      expect(result.plan.questions.size).toBe(200);
    }
  );

  test("plans every question of the largest fixture in four calls, three at a time, summing usage", async () => {
    const requests: TQsfPlanRequest[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const recorded = recordedGenerate(loadRecordedPlan("large-150.qsf"));
    const generate: TQsfPlanGenerate = async (request) => {
      requests.push(request);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      const result = await recorded(request);
      // One provider reports no input count: the sum must not turn into NaN.
      return requests.length === 1
        ? { ...result, usage: { outputTokens: result.usage?.outputTokens } }
        : result;
    };

    const result = await plan("large-150.qsf", generate);

    expect(result.calls).toBe(4);
    expect(maxInFlight).toBe(3);
    expect(result.plan.questions.size).toBe(150);
    expect(result.plan.failures.size).toBe(0);
    expect(Number.isFinite(result.usage.inputTokens) && result.usage.inputTokens > 0).toBe(true);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
    expect(requests.every((request) => request.timeout === QSF_AI_CALL_TIMEOUT_MS)).toBe(true);
    expect(requests.every((request) => request.maxOutputTokens === 8192)).toBe(true);
  });

  test("skips types Formbricks cannot represent without asking the model about them", async () => {
    const prompts: string[] = [];
    const result = await plan(
      "matrix-slider-ranking.qsf",
      recordedGenerate(loadRecordedPlan("matrix-slider-ranking.qsf"), (request) =>
        prompts.push(request.prompt)
      )
    );

    const asked = prompts.flatMap(refsInPrompt);
    expect(asked).not.toEqual(expect.arrayContaining(["QID9"]));
    expect(asked).not.toContain("QID10");
    expect(asked).not.toContain("QID11");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        {
          code: "question_skipped",
          severity: "info",
          questionTag: "Q9",
          params: { cause: "unsupported_type", qualtricsType: "Timing" },
        },
        {
          code: "question_skipped",
          severity: "warning",
          questionTag: "Q10",
          params: { cause: "unsupported_type", qualtricsType: "CS" },
        },
        {
          code: "question_skipped",
          severity: "warning",
          questionTag: "Q12",
          params: {
            cause: "ai_skipped",
            description: "A ranking of 26 options; Formbricks ranks at most 25.",
          },
        },
      ])
    );
  });

  test("splits a chunk that ran out of output tokens and asks for each half", async () => {
    const recorded = recordedGenerate(loadRecordedPlan("simple.qsf"));
    const sizes: number[] = [];
    const generate: TQsfPlanGenerate = async (request) => {
      sizes.push(refsInPrompt(request.prompt).length);
      if (sizes.length === 1) throw tooLong();
      return recorded(request);
    };

    const result = await plan("simple.qsf", generate);

    expect(sizes).toEqual([5, 3, 2]);
    expect(result.plan.questions.size).toBe(5);
  });

  test("retries a half that still did not fit with the other failing questions, once", async () => {
    const recorded = recordedGenerate(loadRecordedPlan("simple.qsf"));
    const calls: string[][] = [];
    const generate: TQsfPlanGenerate = async (request) => {
      const refs = refsInPrompt(request.prompt);
      calls.push(refs);
      if (calls.length <= 2) throw tooLong();
      return recorded(request);
    };

    const result = await plan("simple.qsf", generate);

    // The chunk, its first half (too long again: not split twice), its second half, then the retry.
    expect(calls).toEqual([
      ["QID1", "QID2", "QID3", "QID4", "QID5"],
      ["QID1", "QID2", "QID3"],
      ["QID4", "QID5"],
      ["QID1", "QID2", "QID3"],
    ]);
    expect(result.plan.questions.size).toBe(5);
  });

  test("retries the questions a hostile plan got wrong, telling the model why", async () => {
    const hostile = loadRecordedPlan("hostile");
    const recorded = recordedGenerate(loadRecordedPlan("simple.qsf"));
    const prompts: string[] = [];
    const generate: TQsfPlanGenerate = async (request) => {
      prompts.push(request.prompt);
      return prompts.length === 1 ? { object: hostile } : recorded(request);
    };

    const result = await plan("simple.qsf", generate);

    expect(prompts).toHaveLength(2);
    expect(refsInPrompt(prompts[1])).toEqual(["QID1", "QID2", "QID3", "QID4", "QID5"]);
    expect(prompts[1]).toContain("- QID2: its type is not allowed");
    expect(prompts[1]).toContain("- QID3: a key it used belongs to no option of this question");
    expect(result.plan.questions.size).toBe(5);
    expect(result.issues).toEqual([]);
  });

  test("drops what is still wrong after the retry, and no report line carries the plan's links", async () => {
    const hostile = loadRecordedPlan("hostile");

    const result = await plan("simple.qsf", async () => ({ object: hostile }));

    expect(result.calls).toBe(2);
    expect(result.plan.questions.size).toBe(0);
    expect(result.issues.map((issue) => issue.params?.cause)).toEqual(Array(5).fill("plan_invalid"));
    expect(JSON.stringify(result.issues)).not.toMatch(/https?:|evil/);
  });

  test("retries a chunk whose output did not match the schema", async () => {
    const recorded = recordedGenerate(loadRecordedPlan("simple.qsf"));
    let calls = 0;
    const generate: TQsfPlanGenerate = async (request) => {
      calls += 1;
      if (calls === 1) {
        throw new NoObjectGeneratedError({
          response: { id: "r", timestamp: new Date(), modelId: "m" },
          usage: {} as never,
          finishReason: "stop",
        });
      }
      return recorded(request);
    };

    const result = await plan("simple.qsf", generate);

    expect(calls).toBe(2);
    expect(result.plan.questions.size).toBe(5);
  });

  test("never makes more calls than the cap, and drops what is left instead of failing", async () => {
    const generate = vi.fn<TQsfPlanGenerate>(async () => {
      throw tooLong();
    });

    const result = await plan("large-150.qsf", generate);

    // Four chunks: 3 × 4 + 2 = 14 calls, every one of them too long.
    expect(generate).toHaveBeenCalledTimes(14);
    expect(result.calls).toBe(14);
    expect(result.plan.questions.size).toBe(0);
    // What the retry round could not ask for is dropped as unplanned, not failed.
    expect(result.issues.length).toBe(150);
    expect(result.issues.map((issue) => issue.params?.cause)).toContain("ai_budget");
  });

  describe("a survey at the question limit with two rules on every question", () => {
    const logicHeavy = () =>
      buildOversizedLogicQsf({ groups: 1, conditions: 1, skipRules: 1, branches: false, valueLength: 10 });

    test("plans every question within the cap", async () => {
      const result = await planSurvey(logicHeavy(), vi.fn(answerEverything));

      expect(result.plan.questions.size).toBe(200);
      expect(result.calls).toBeLessThanOrEqual(QSF_MAX_AI_CALLS);
    });

    test("still plans every question when every chunk has to be split", async () => {
      const asked = new Set<string>();
      const generate = vi.fn<TQsfPlanGenerate>(async (request) => {
        // The first ask of each chunk runs out of tokens; its halves fit.
        const key = refsInPrompt(request.prompt)[0];
        const isWholeChunk = !asked.has(key);
        for (const ref of refsInPrompt(request.prompt)) asked.add(ref);
        if (isWholeChunk && refsInPrompt(request.prompt).length > 1) throw tooLong();
        return answerEverything(request);
      });

      const result = await planSurvey(logicHeavy(), generate);

      expect(result.plan.questions.size).toBe(200);
      expect(result.plan.failures.size).toBe(0);
      expect(result.calls).toBeLessThanOrEqual(QSF_MAX_AI_CALLS);
      // Each chunk asked once whole and once per half.
      expect(result.calls % 3).toBe(0);
    });
  });

  test("sizes the call ceiling from the reader's limits", () => {
    // 200 questions on 200 pages, three rules described on each: 200 × (70 + 10 + 2 × 3 × 45) tokens
    // in 3,000-token chunks, asked once, split once and retried twice.
    expect(QSF_MAX_AI_CALLS).toBe(3 * Math.ceil((200 * (70 + 10 + 270)) / 3_000) + 2);
  });

  test("lets a quota failure through unwrapped, and cancels the calls running beside it", async () => {
    const quota = new TooManyRequestsError("ai_quota_exceeded", 30);
    const siblings: AbortSignal[] = [];
    let calls = 0;
    const generate: TQsfPlanGenerate = (request) => {
      calls += 1;
      if (calls === 1) return Promise.reject(quota);
      siblings.push(request.abortSignal);
      return new Promise((_resolve, reject) =>
        request.abortSignal.addEventListener("abort", () => reject(request.abortSignal.reason), {
          once: true,
        })
      );
    };

    await expect(plan("large-150.qsf", generate)).rejects.toBe(quota);
    expect(siblings.length).toBeGreaterThan(0);
    expect(siblings.every((signal) => signal.aborted)).toBe(true);
  });

  test("turns the AI SDK's own timeout into the import's timeout", async () => {
    const generate: TQsfPlanGenerate = async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    };

    await expect(plan("simple.qsf", generate)).rejects.toBeInstanceOf(QsfImportTimeoutError);
  });

  test("lets the import's own abort through as is, for the route to classify", async () => {
    const controller = new AbortController();
    const generate: TQsfPlanGenerate = (request) =>
      new Promise((_resolve, reject) => {
        request.abortSignal.addEventListener("abort", () => reject(request.abortSignal.reason), {
          once: true,
        });
        controller.abort(new DOMException("Stopped", "AbortError"));
      });

    const error = await plan("simple.qsf", generate, { signal: controller.signal }).catch(
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe("AbortError");
  });

  test("sizes each call's timeout to what is left before the deadline", async () => {
    const hostile = loadRecordedPlan("hostile");
    const timeouts: number[] = [];
    const generate: TQsfPlanGenerate = async (request) => {
      timeouts.push(request.timeout);
      return { object: hostile };
    };

    // 20 s left, 5 s of which are kept for assembly.
    await plan("simple.qsf", generate, { deadlineInMs: 20_000 });

    expect(timeouts).toHaveLength(2);
    for (const timeout of timeouts) {
      expect(timeout).toBeLessThanOrEqual(15_000);
      expect(timeout).toBeGreaterThan(14_000);
    }
  });

  test("skips the retry when no time is left for it, dropping what failed", async () => {
    const hostile = loadRecordedPlan("hostile");
    // The first call takes the time there was: 5.4 s to the deadline, 5 s kept for assembly.
    const generate = vi.fn<TQsfPlanGenerate>(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { object: hostile };
    });

    const result = await plan("simple.qsf", generate, { deadlineInMs: 5_400 });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.plan.failures.size).toBe(5);
    expect(result.issues.map((issue) => issue.params?.cause)).toEqual(Array(5).fill("ai_budget"));
  });

  test("sizes the timeout of each half of a split again, so the halves cannot pass the deadline", async () => {
    const timeouts: number[] = [];
    const recorded = recordedGenerate(loadRecordedPlan("simple.qsf"));
    const generate: TQsfPlanGenerate = async (request) => {
      timeouts.push(request.timeout);
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (timeouts.length === 1) throw tooLong();
      return recorded(request);
    };

    await plan("simple.qsf", generate, { deadlineInMs: 6_000 });

    expect(timeouts).toHaveLength(3);
    // Each later call gets what is left, not the first call's budget again.
    expect(timeouts[1]).toBeLessThanOrEqual(timeouts[0] - 250);
    expect(timeouts[2]).toBeLessThanOrEqual(timeouts[1] - 250);
  });
});
