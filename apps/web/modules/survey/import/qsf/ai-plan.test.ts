import { NoObjectGeneratedError } from "ai";
import { describe, expect, test, vi } from "vitest";
import { AIOutputTokenLimitError } from "@formbricks/ai";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { loadQsfFixture } from "./__fixtures__/load-fixture";
import { loadRecordedPlan, recordedGenerate, refsInPrompt } from "./__fixtures__/recorded-plans";
import {
  QSF_AI_CALL_TIMEOUT_MS,
  QSF_MAX_AI_CALLS,
  type TQsfPlanGenerate,
  type TQsfPlanRequest,
  chunkQuestions,
  planQsfImport,
} from "./ai-plan";
import { QsfImportFailedError, QsfImportTimeoutError } from "./errors";
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

const tooLong = () => new AIOutputTokenLimitError({ maxOutputTokens: 8192, outputTokens: 8192 });

describe("chunkQuestions", () => {
  test("splits a large survey at page boundaries into at most three chunks", async () => {
    const { survey } = await prepare("large-150.qsf");

    const chunks = chunkQuestions(survey, [...survey.questions.keys()], 3);

    expect(chunks).toHaveLength(3);
    expect(chunks.flat()).toEqual([...survey.questions.keys()]);
    // Each chunk ends on a page boundary (pages of five).
    for (const chunk of chunks.slice(0, -1)) expect(chunk.length % 5).toBe(0);
  });
});

describe("planQsfImport", () => {
  test("plans every question of the largest fixture in three parallel calls, summing usage", async () => {
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

    expect(result.calls).toBe(3);
    expect(maxInFlight).toBe(3);
    expect(result.plan.questions.size).toBe(150);
    expect(result.plan.blocks).toHaveLength(30);
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

  test("never makes more than the cap of calls, and fails the import when it is reached", async () => {
    const generate = vi.fn<TQsfPlanGenerate>(async () => {
      throw tooLong();
    });

    const error = await plan("large-150.qsf", generate).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(QsfImportFailedError);
    expect((error as QsfImportFailedError).reason).toBe("ai_call_budget");
    expect(generate.mock.calls.length).toBeLessThanOrEqual(QSF_MAX_AI_CALLS);
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
    const generate = vi.fn<TQsfPlanGenerate>(async () => ({ object: hostile }));

    const result = await plan("simple.qsf", generate, { deadlineInMs: 4_000 });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.plan.failures.size).toBe(5);
    expect(result.issues.map((issue) => issue.params?.cause)).toEqual(Array(5).fill("plan_invalid"));
  });
});
