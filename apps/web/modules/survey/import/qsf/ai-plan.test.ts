import { APICallError, NoObjectGeneratedError } from "ai";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AIOutputTokenLimitError } from "@formbricks/ai";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { loadQsfFixture } from "./__fixtures__/load-fixture";
import { buildOversizedLogicQsf } from "./__fixtures__/oversized-logic";
import {
  loadRecordedPlan,
  recordedGenerate,
  refsInPrompt,
  timedGenerate,
} from "./__fixtures__/recorded-plans";
import {
  QSF_AI_CALL_TIMEOUT_MS,
  QSF_ASSEMBLY_RESERVE_MS,
  QSF_CHUNK_OUTPUT_TOKENS,
  QSF_MAX_AI_CALLS,
  QSF_MAX_OUTPUT_TOKENS,
  QSF_MIN_CALL_TIMEOUT_MS,
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

    // 70 expected tokens a question: 20 to a 1,400-token chunk.
    expect(chunks.map((chunk) => chunk.length)).toEqual([20, 20, 20, 20, 20, 20, 20, 10]);
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

  test("plans every question of the largest fixture in eight calls, four at a time, summing usage", async () => {
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

    expect(result.calls).toBe(8);
    expect(maxInFlight).toBe(4);
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
          questionRef: "QID9",
          params: { cause: "unsupported_type", qualtricsType: "Timing" },
        },
        {
          code: "question_skipped",
          severity: "warning",
          questionTag: "Q10",
          questionRef: "QID10",
          params: { cause: "unsupported_type", qualtricsType: "CS" },
        },
        {
          code: "question_skipped",
          severity: "warning",
          questionTag: "Q12",
          questionRef: "QID12",
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

  test("counts the tokens of calls that failed, from their counts and never their text", async () => {
    const calls: number[] = [];
    const generate: TQsfPlanGenerate = async () => {
      calls.push(calls.length);
      if (calls.length === 1)
        throw new AIOutputTokenLimitError({ maxOutputTokens: 8192, reasoningTokens: 6000 });
      if (calls.length === 2) {
        throw new NoObjectGeneratedError({
          response: { id: "r", timestamp: new Date(), modelId: "m" },
          usage: { inputTokens: 900, outputTokens: 1234 } as never,
          finishReason: "stop",
        });
      }
      return {
        object: { questions: [], skipped: [], pages: [] },
        usage: { inputTokens: 100, outputTokens: 10 },
      };
    };

    const result = await plan("simple.qsf", generate);

    // The chunk ran out of its 8,192 (reasoning included), its first half failed the schema, the
    // rest answered with nothing: 10 tokens a call.
    expect(result.usage.outputTokens).toBe(8192 + 1234 + 10 * (result.calls - 2));
    expect(result.usage.inputTokens).toBe(900 + 100 * (result.calls - 2));
  });

  test("counts a call that ran out of tokens without saying how many as its whole budget", async () => {
    let calls = 0;
    const generate: TQsfPlanGenerate = async () => {
      calls += 1;
      throw new AIOutputTokenLimitError({});
    };

    const result = await plan("legacy-object-payload.qsf", generate);

    expect(result.usage.outputTokens).toBe(calls * QSF_PLAN_MAX_OUTPUT_TOKENS);
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
    // Out of tokens after a hundred, so the output budget is not what stops it.
    const generate = vi.fn<TQsfPlanGenerate>(async () => {
      throw new AIOutputTokenLimitError({ maxOutputTokens: 8192, outputTokens: 100 });
    });

    const result = await plan("large-150.qsf", generate);

    // Eight chunks: 3 × 8 + 2 = 26 calls, every one of them too long.
    expect(generate).toHaveBeenCalledTimes(26);
    expect(result.calls).toBe(26);
    expect(result.plan.questions.size).toBe(0);
    // What the retry round could not ask for is dropped as unplanned, not failed.
    expect(result.issues).toHaveLength(150);
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

  test("sizes the ceilings from the reader's limits", () => {
    // 200 questions on 200 pages, three rules described on each: 200 × (70 + 10 + 2 × 3 × 45) =
    // 70,000 tokens in 1,400-token chunks, 50 of them.
    expect(QSF_MAX_AI_CALLS).toBe(152);
    expect(QSF_MAX_OUTPUT_TOKENS).toBe(835_584);
  });

  test("stops calling once the import's output tokens are spent, dropping the rest", async () => {
    const generate = vi.fn<TQsfPlanGenerate>(async () => {
      throw tooLong();
    });

    const result = await plan("large-150.qsf", generate);

    // Eight chunks: (2 × 8 + 2) × 8,192 tokens, eighteen calls that use all of theirs, before the call
    // cap of 26. At most the three other calls already in flight run past it.
    expect(generate.mock.calls.length).toBeLessThanOrEqual(18 + 3);
    expect(result.usage.outputTokens).toBeLessThanOrEqual(21 * 8192);
    expect(result.issues.map((issue) => issue.params?.cause)).toContain("ai_budget");
  });

  test("lets a quota failure through unwrapped, and cancels the calls running beside it", async () => {
    // A Retry-After past the call's 45 s: not waited out.
    const quota = new TooManyRequestsError("ai_quota_exceeded", 60);
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

  test("ends in the import's timeout only when the calls ran out of time before any question was planned", async () => {
    const generate = vi.fn<TQsfPlanGenerate>(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });

    await expect(plan("simple.qsf", generate)).rejects.toBeInstanceOf(QsfImportTimeoutError);
    // The chunk, then its two halves: a timed-out call is split like one that ran out of tokens.
    expect(generate).toHaveBeenCalledTimes(3);
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

  test("lets an AbortError through when the import itself was stopped, not as a timeout", async () => {
    const controller = new AbortController();
    const generate = vi.fn<TQsfPlanGenerate>(async () => {
      controller.abort(new DOMException("Stopped", "AbortError"));
      throw new DOMException("Delay was aborted", "AbortError");
    });

    const error = await plan("simple.qsf", generate, { signal: controller.signal }).catch(
      (caught: unknown) => caught
    );

    expect((error as DOMException).name).toBe("AbortError");
    expect((error as DOMException).message).toBe("Delay was aborted");
    // Not split: the import is over.
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test("never sends a call with less time than one needs, and ends in the import's timeout", async () => {
    const generate = vi.fn<TQsfPlanGenerate>(recordedGenerate(loadRecordedPlan("simple.qsf")));

    // 9.9 s to the deadline, 5 s kept for assembly: 4.9 s for the call, under the minimum. Nothing
    // was planned because time ran out, so to the user the import took too long.
    await expect(plan("simple.qsf", generate, { deadlineInMs: 9_900 })).rejects.toBeInstanceOf(
      QsfImportTimeoutError
    );
    expect(generate).not.toHaveBeenCalled();
  });

  test("does not call it a timeout when the calls ran out, not the time", async () => {
    const generate = vi.fn<TQsfPlanGenerate>(async () => {
      throw tooLong();
    });

    const result = await plan("simple.qsf", generate);

    // The chunk, its halves and the retry round, every one too long: out of calls, with time to spare.
    expect(result.plan.questions.size).toBe(0);
    expect(result.issues.map((issue) => issue.params?.cause)).not.toContain("ai_timeout");
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
    // 10.4 s to the deadline, 5 s kept for assembly: the first call gets 5.4 s and takes 0.5 s of it,
    // so the retry would get under the 5 s a call needs. The first call leaves QID1 and QID2 out.
    const recorded = loadRecordedPlan("simple.qsf");
    const partial = {
      ...recorded,
      questions: recorded.questions.filter((entry) => entry.ref !== "QID1" && entry.ref !== "QID2"),
    };
    const generate = vi.fn<TQsfPlanGenerate>(async (request) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return recordedGenerate(partial)(request);
    });

    const result = await plan("simple.qsf", generate, { deadlineInMs: 10_400 });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.plan.questions.size).toBe(3);
    expect([...result.plan.failures.keys()]).toEqual(["QID1", "QID2"]);
    expect(result.issues.map((issue) => issue.params?.cause)).toEqual(["ai_budget", "ai_budget"]);
  });

  test("sizes the timeout of each half of a split when it starts, so the halves cannot pass the deadline", async () => {
    const timeouts: number[] = [];
    const recorded = recordedGenerate(loadRecordedPlan("simple.qsf"));
    const generate: TQsfPlanGenerate = async (request) => {
      timeouts.push(request.timeout);
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (timeouts.length === 1) throw tooLong();
      return recorded(request);
    };

    // 5.8 s for the first call, and over the 5 s minimum for each half after it.
    await plan("simple.qsf", generate, { deadlineInMs: 10_800 });

    expect(timeouts).toHaveLength(3);
    // The halves run side by side after the chunk, each with what is left, not the chunk's budget again.
    expect(timeouts[1]).toBeLessThanOrEqual(timeouts[0] - 250);
    expect(timeouts[2]).toBeLessThanOrEqual(timeouts[0] - 250);
  });
});

describe("planQsfImport with a model that takes time", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Plan large-150 against a model on fake timers, running the clock until the plan settles. */
  const planTimed = async (
    latencyFor: (refs: string[]) => number,
    edit: (refs: string[], object: unknown) => unknown = (_refs, object) => object,
    timedOut?: () => Error
  ) => {
    const { survey, texts } = await prepare("large-150.qsf");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "performance"] });
    const requests: { refs: string[]; timeout: number; at: number }[] = [];
    const timedAnswer = timedGenerate(loadRecordedPlan("large-150.qsf"), latencyFor, timedOut);
    const timed: TQsfPlanGenerate = async (request) => {
      const answer = await timedAnswer(request);
      return { ...answer, object: edit(refsInPrompt(request.prompt), answer.object) };
    };
    const startedAt = performance.now();
    const deadline = startedAt + 120_000;
    const settled = planQsfImport({
      survey,
      texts,
      generate: (request) => {
        requests.push({
          refs: refsInPrompt(request.prompt),
          timeout: request.timeout,
          at: performance.now() - startedAt,
        });
        return timed(request);
      },
      signal: new AbortController().signal,
      deadline,
    }).then(
      (result) => ({ result, error: null, elapsed: performance.now() - startedAt }),
      (error: unknown) => ({ result: null, error, elapsed: performance.now() - startedAt })
    );
    await vi.advanceTimersByTimeAsync(130_000);
    return { ...(await settled), requests };
  };

  test("plans 150 questions inside the deadline at the slow end of the model's speed, retry round included", async () => {
    // 31 s a call, the slow end for a 1,400-token chunk; the first wave leaves QID1 out, so it goes to
    // the retry round. Two waves of four, then the retry: about 93 s.
    let firstWave = true;
    const { result, error, elapsed, requests } = await planTimed(
      () => 31_000,
      (refs, object) => {
        if (!firstWave || !refs.includes("QID1")) return object;
        firstWave = false;
        const plan = object as { questions: { ref: string }[] };
        return { ...plan, questions: plan.questions.filter((entry) => entry.ref !== "QID1") };
      }
    );

    expect(error).toBeNull();
    expect(result?.plan.questions.size).toBe(150);
    expect(requests).toHaveLength(9);
    expect(elapsed).toBeLessThanOrEqual(120_000 - QSF_ASSEMBLY_RESERVE_MS);
  });

  test("splits a chunk whose call ran past its timeout and plans its halves, instead of failing", async () => {
    // The first chunk's call stalls; every other call, its halves included, takes 20 s.
    const { result, error, requests } = await planTimed((refs) =>
      refs.includes("QID1") && refs.length === 20 ? Infinity : 20_000
    );

    expect(error).toBeNull();
    expect(result?.plan.questions.size).toBe(150);
    expect(result?.plan.failures.size).toBe(0);
    // Eight chunks and two halves; the halves start once the stalled call has timed out.
    expect(requests.map((request) => request.refs.length)).toEqual([20, 20, 20, 20, 20, 20, 20, 10, 10, 10]);
    expect(requests.slice(0, 8).every((request) => request.timeout === QSF_AI_CALL_TIMEOUT_MS)).toBe(true);
    expect(requests.slice(8).every((request) => request.at >= QSF_AI_CALL_TIMEOUT_MS)).toBe(true);
  });

  test("treats a timeout that fires during the SDK's retry backoff, an AbortError, as the call's timeout", async () => {
    // The AI SDK rejects with its backoff delay's AbortError when the call's timeout fires between
    // retries (seen with a 503 and ai@6): the import's own signal has not fired, so it is a timeout.
    const { result, error, requests } = await planTimed(
      (refs) => (refs.includes("QID1") && refs.length === 20 ? Infinity : 20_000),
      undefined,
      () => new DOMException("Delay was aborted", "AbortError")
    );

    expect(error).toBeNull();
    expect(result?.plan.questions.size).toBe(150);
    expect(requests.map((request) => request.refs.length).slice(-2)).toEqual([10, 10]);
  });

  test("drops the questions whose halves time out too, as ai_timeout, and keeps the rest", async () => {
    const { result, error } = await planTimed((refs) => (refs.includes("QID1") ? Infinity : 20_000));

    expect(error).toBeNull();
    // The first chunk's second half (QID11–QID20) answered; its first half timed out again.
    expect(result?.plan.questions.size).toBe(140);
    expect([...(result?.plan.failures.values() ?? [])]).toEqual(Array(10).fill(["ai_timeout"]));
    const causes = result?.issues.map((issue) => issue.params?.cause);
    expect(causes).toEqual(Array(10).fill("ai_timeout"));
  });

  test("never runs a call past the deadline: late calls get what is left, and what time ran out on is dropped", async () => {
    // Every whole chunk stalls and every half takes 20 s, so the halves queue up against the deadline.
    const { result, error, requests, elapsed } = await planTimed((refs) =>
      refs.length === 20 ? Infinity : 20_000
    );
    const lastMoment = 120_000 - QSF_ASSEMBLY_RESERVE_MS;

    expect(error).toBeNull();
    const planned = result?.plan.questions.size ?? 0;
    expect(planned).toBeGreaterThan(0);
    expect(planned).toBeLessThan(150);
    expect(result?.issues).toHaveLength(150 - planned);
    expect(
      result?.issues.every((issue) => ["ai_timeout", "ai_budget"].includes(String(issue.params?.cause)))
    ).toBe(true);
    expect(requests.some((request) => request.timeout < QSF_AI_CALL_TIMEOUT_MS)).toBe(true);
    // A call too short to come back with a plan is never sent; its questions are dropped instead.
    expect(requests.every((request) => request.timeout >= QSF_MIN_CALL_TIMEOUT_MS)).toBe(true);
    for (const request of requests) expect(request.at + request.timeout).toBeLessThanOrEqual(lastMoment);
    expect(elapsed).toBeLessThanOrEqual(lastMoment);
  });

  test("ends in the import's timeout when every call stalls, inside the deadline", async () => {
    const { result, error, elapsed, requests } = await planTimed(() => Infinity);

    expect(result).toBeNull();
    expect(error).toBeInstanceOf(QsfImportTimeoutError);
    expect(elapsed).toBeLessThanOrEqual(120_000 - QSF_ASSEMBLY_RESERVE_MS);
    for (const request of requests) {
      expect(request.at + request.timeout).toBeLessThanOrEqual(120_000 - QSF_ASSEMBLY_RESERVE_MS);
    }
  });
});

describe("planQsfImport retrying a call itself", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const providerError = (statusCode: number) =>
    new APICallError({
      message: "provider failure",
      url: "https://provider.example.com/v1/chat/completions",
      requestBodyValues: {},
      statusCode,
      responseHeaders: {},
    });

  /**
   * Plan simple.qsf (one chunk of five questions) on fake timers, the clock run until it settles.
   * `respond` answers each request; every request is recorded with when it was sent.
   */
  const planRetrying = async (
    respond: (request: TQsfPlanRequest, index: number) => Promise<Awaited<ReturnType<TQsfPlanGenerate>>>,
    options: {
      signal?: AbortSignal;
      abortAt?: { controller: AbortController; ms: number };
      fixture?: string;
    } = {}
  ) => {
    const { survey, texts } = await prepare(options.fixture ?? "simple.qsf");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "performance"] });
    const startedAt = performance.now();
    const requests: { refs: string[]; timeout: number; maxRetries: number; at: number }[] = [];
    if (options.abortAt) {
      const { controller, ms } = options.abortAt;
      setTimeout(() => controller.abort(new DOMException("Stopped", "AbortError")), ms);
    }
    const settled = planQsfImport({
      survey,
      texts,
      generate: (request) => {
        requests.push({
          refs: refsInPrompt(request.prompt),
          timeout: request.timeout,
          maxRetries: request.maxRetries,
          at: performance.now() - startedAt,
        });
        return respond(request, requests.length - 1);
      },
      signal: options.abortAt?.controller.signal ?? new AbortController().signal,
      deadline: startedAt + 120_000,
    }).then(
      (result) => ({ result, error: null as unknown }),
      (error: unknown) => ({ result: null, error })
    );
    await vi.advanceTimersByTimeAsync(130_000);
    return { ...(await settled), requests };
  };

  const answer = recordedGenerate(loadRecordedPlan("simple.qsf"));
  const answerLarge = recordedGenerate(loadRecordedPlan("large-150.qsf"));

  /** Settle after `ms` of fake time, or reject at once when the request's signal aborts. */
  const after = <T>(request: TQsfPlanRequest, ms: number, outcome: () => Promise<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => outcome().then(resolve, reject), ms);
      request.abortSignal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(request.abortSignal.reason);
        },
        { once: true }
      );
    });

  test("lets a 429 through as the quota error when its Retry-After is past the call's time, unsplit", async () => {
    const quota = new TooManyRequestsError("ai_quota_exceeded", 50);

    const { error, requests } = await planRetrying(() => Promise.reject(quota));

    expect(error).toBe(quota);
    expect(requests).toHaveLength(1);
  });

  test("waits out a 429 with a short Retry-After and sends the call again", async () => {
    const quota = new TooManyRequestsError("ai_quota_exceeded", 3);

    const { result, error, requests } = await planRetrying((request, index) =>
      index === 0 ? Promise.reject(quota) : answer(request)
    );

    expect(error).toBeNull();
    expect(result?.plan.questions.size).toBe(5);
    expect(result?.calls).toBe(2);
    expect(requests.map((request) => request.refs.length)).toEqual([5, 5]);
    expect(requests[1].at).toBeGreaterThanOrEqual(3_000);
    // The retry gets what is left of the call's time, and the SDK never retries on its own.
    expect(requests[1].timeout).toBeLessThanOrEqual(QSF_AI_CALL_TIMEOUT_MS - 3_000);
    expect(requests.every((request) => request.maxRetries === 0)).toBe(true);
  });

  test("splits a chunk whose 503s outlast the call's time, as a timed-out call", async () => {
    // The whole chunk fails slowly with a 503; its halves answer.
    const { result, error, requests } = await planRetrying((request) =>
      refsInPrompt(request.prompt).length === 5
        ? after(request, 20_000, () => Promise.reject(providerError(503)))
        : answer(request)
    );

    expect(error).toBeNull();
    expect(result?.plan.questions.size).toBe(5);
    // 20 s, a backoff of 1–2 s, 20 s more: too little left for a third, so the call timed out.
    expect(requests.map((request) => request.refs.length)).toEqual([5, 5, 3, 2]);
    expect(requests[1].at).toBeGreaterThanOrEqual(21_000);
  });

  test("drops a chunk as ai_budget when the budget leaves no room to retry its 503, and carries on", async () => {
    // large-150, four calls at a time. The first fails with a 503 after 1 s; the second answers at once
    // but spends the import's whole output budget; the third and fourth answer at 5 s, still in flight
    // when the first would retry.
    const signals: AbortSignal[] = [];
    const { result, error, requests } = await planRetrying(
      (request, index) => {
        signals.push(request.abortSignal);
        if (index === 0) return after(request, 1_000, () => Promise.reject(providerError(503)));
        if (index === 1) {
          return answerLarge(request).then((answered) => ({
            ...answered,
            usage: { inputTokens: 1, outputTokens: 10 * QSF_MAX_OUTPUT_TOKENS },
          }));
        }
        return after(request, 5_000, () => answerLarge(request));
      },
      { fixture: "large-150.qsf" }
    );

    expect(error).toBeNull();
    // The 503's chunk was not retried and no other chunk was asked: the budget was spent.
    expect(requests).toHaveLength(4);
    const firstChunk = requests[0].refs;
    // The calls beside it were not cancelled: their questions are planned.
    expect(signals.some((signal) => signal.aborted)).toBe(false);
    for (const ref of [...requests[2].refs, ...requests[3].refs]) {
      expect(result?.plan.questions.has(ref)).toBe(true);
    }
    const dropped = result?.issues.filter((issue) => issue.params?.cause === "ai_budget") ?? [];
    expect(dropped.map((issue) => issue.questionRef)).toEqual(expect.arrayContaining(firstChunk));
    expect(result?.issues.every((issue) => issue.params?.cause === "ai_budget")).toBe(true);
  });

  test("stops at once when the import is aborted while it waits to retry", async () => {
    const controller = new AbortController();
    const quota = new TooManyRequestsError("ai_quota_exceeded", 10);

    const { error, requests } = await planRetrying(() => Promise.reject(quota), {
      abortAt: { controller, ms: 5_000 },
    });

    expect((error as DOMException).name).toBe("AbortError");
    expect((error as DOMException).message).toBe("Stopped");
    expect(requests).toHaveLength(1);
  });
});
