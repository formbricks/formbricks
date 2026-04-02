import { PipelineTriggers } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TResponse } from "@formbricks/types/responses";
import {
  PIPELINE_RETRY_BASE_DELAY_MS,
  drainPipelineQueue,
  enqueuePipelineJob,
} from "@/app/lib/pipeline-queue";
import { TPipelineInput } from "@/app/lib/types/pipelines";

const { mockGetRedisClient, mockTryLock } = vi.hoisted(() => ({
  mockGetRedisClient: vi.fn(),
  mockTryLock: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  cache: {
    getRedisClient: mockGetRedisClient,
    tryLock: mockTryLock,
  },
}));

vi.mock("@/lib/constants", () => ({
  CRON_SECRET: "test-cron-secret",
  WEBAPP_URL: "https://test.formbricks.com",
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

type TMockRedis = {
  pending: string[];
  delayed: Array<{ score: number; value: string }>;
  client: {
    rPush: ReturnType<typeof vi.fn>;
    lPop: ReturnType<typeof vi.fn>;
    lLen: ReturnType<typeof vi.fn>;
    zAdd: ReturnType<typeof vi.fn>;
    zRangeByScore: ReturnType<typeof vi.fn>;
    zRangeByScoreWithScores: ReturnType<typeof vi.fn>;
    zRem: ReturnType<typeof vi.fn>;
    eval: ReturnType<typeof vi.fn>;
  };
};

const createMockRedis = (): TMockRedis => {
  const pending: string[] = [];
  const delayed: Array<{ score: number; value: string }> = [];

  const client = {
    rPush: vi.fn(async (_key: string, value: string) => {
      pending.push(value);
      return pending.length;
    }),
    lPop: vi.fn(async () => pending.shift() ?? null),
    lLen: vi.fn(async () => pending.length),
    zAdd: vi.fn(async (_key: string, value: { score: number; value: string }) => {
      delayed.push({ score: value.score, value: value.value });
      delayed.sort((left, right) => left.score - right.score);
      return 1;
    }),
    zRangeByScore: vi.fn(async (_key: string, min: number | string, max: number | string) => {
      const parsedMin = typeof min === "string" ? Number(min) : min;
      const parsedMax = max === "+inf" ? Number.POSITIVE_INFINITY : Number(max);
      return delayed
        .filter((entry) => entry.score >= parsedMin && entry.score <= parsedMax)
        .map((entry) => entry.value);
    }),
    zRangeByScoreWithScores: vi.fn(
      async (
        _key: string,
        min: number | string,
        max: number | string,
        options?: { LIMIT?: { offset: number; count: number } }
      ) => {
        const parsedMin = typeof min === "string" ? Number(min) : min;
        const parsedMax = max === "+inf" ? Number.POSITIVE_INFINITY : Number(max);
        const count = options?.LIMIT?.count ?? delayed.length;

        return delayed
          .filter((entry) => entry.score >= parsedMin && entry.score <= parsedMax)
          .slice(0, count)
          .map((entry) => ({ value: entry.value, score: entry.score }));
      }
    ),
    zRem: vi.fn(async (_key: string, value: string) => {
      const before = delayed.length;
      for (let index = delayed.length - 1; index >= 0; index--) {
        if (delayed[index].value === value) {
          delayed.splice(index, 1);
        }
      }
      return before - delayed.length;
    }),
    eval: vi.fn(async (_script: string, options?: { keys?: string[]; arguments?: string[] }) => {
      const keys = options?.keys ?? [];

      if (keys.length === 2) {
        const maxScore = Number(options?.arguments?.[0] ?? Date.now());
        const readyJobs = delayed
          .filter((entry) => entry.score >= 0 && entry.score <= maxScore)
          .sort((left, right) => left.score - right.score);

        if (readyJobs.length === 0) {
          return 0;
        }

        for (let index = delayed.length - 1; index >= 0; index--) {
          if (delayed[index].score >= 0 && delayed[index].score <= maxScore) {
            delayed.splice(index, 1);
          }
        }

        pending.push(...readyJobs.map((entry) => entry.value));
        return readyJobs.length;
      }

      return 1;
    }),
  };

  return { pending, delayed, client };
};

const createPipelineInput = (id: string): TPipelineInput => ({
  event: PipelineTriggers.responseCreated,
  surveyId: "cm8ckvchx000008lb710n0gdn",
  environmentId: "cm8cmp9hp000008jf7l570ml2",
  response: {
    id,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
  } as TResponse,
});

describe("pipeline-queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
  });

  test("enqueuePipelineJob stores a job in the pending queue", async () => {
    const mockRedis = createMockRedis();

    mockGetRedisClient.mockResolvedValue(mockRedis.client);

    const queuedJob = await enqueuePipelineJob(createPipelineInput("response-1"));

    expect(mockRedis.client.rPush).toHaveBeenCalledTimes(1);
    expect(mockRedis.client.rPush).toHaveBeenCalledWith("fb:pipeline:jobs:pending", expect.any(String));
    expect(mockRedis.pending).toHaveLength(1);
    expect(queuedJob.jobId).toBeDefined();
    expect(queuedJob.attempt).toBe(1);
    expect(queuedJob.notBefore).toBeNull();
  });

  test("drainPipelineQueue returns early when the drain lock is held elsewhere", async () => {
    const mockRedis = createMockRedis();

    mockGetRedisClient.mockResolvedValue(mockRedis.client);
    mockTryLock.mockResolvedValue({ ok: true, data: false });

    const processJob = vi.fn();

    const result = await drainPipelineQueue({ processJob });

    expect(result).toEqual({
      acquiredLock: false,
      movedReadyJobs: 0,
      processedJobs: 0,
      requeuedJobs: 0,
      droppedJobs: 0,
    });
    expect(processJob).not.toHaveBeenCalled();
  });

  test("drainPipelineQueue caps concurrent processing to three jobs", async () => {
    const mockRedis = createMockRedis();

    mockGetRedisClient.mockResolvedValue(mockRedis.client);
    mockTryLock.mockResolvedValue({ ok: true, data: true });

    for (const index of [1, 2, 3, 4]) {
      await enqueuePipelineJob(createPipelineInput(`response-${index}`));
    }

    let activeJobs = 0;
    let maxActiveJobs = 0;
    const resolvers: Array<() => void> = [];
    const processJob = vi.fn(async () => {
      activeJobs++;
      maxActiveJobs = Math.max(maxActiveJobs, activeJobs);

      await new Promise<void>((resolve) => {
        resolvers.push(() => {
          activeJobs--;
          resolve();
        });
      });
    });

    const drainPromise = drainPipelineQueue({ processJob });
    await vi.waitFor(() => {
      expect(processJob).toHaveBeenCalledTimes(3);
    });

    expect(maxActiveJobs).toBe(3);

    resolvers.splice(0, 3).forEach((resolve) => resolve());

    await vi.waitFor(() => {
      expect(processJob).toHaveBeenCalledTimes(4);
    });

    resolvers[0]?.();

    const result = await drainPromise;

    expect(result.processedJobs).toBe(4);
    expect(result.requeuedJobs).toBe(0);
    expect(result.droppedJobs).toBe(0);
  });

  test("failed jobs are requeued with exponential backoff and schedule another drain", async () => {
    const mockRedis = createMockRedis();
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    mockGetRedisClient.mockResolvedValue(mockRedis.client);
    mockTryLock.mockResolvedValue({ ok: true, data: true });
    vi.stubGlobal("fetch", mockFetch);

    await enqueuePipelineJob(createPipelineInput("response-1"));

    const processJob = vi.fn().mockRejectedValue(new Error("boom"));

    const result = await drainPipelineQueue({ processJob });

    expect(result.processedJobs).toBe(0);
    expect(result.requeuedJobs).toBe(1);
    expect(mockRedis.delayed).toHaveLength(1);

    const retriedJob = JSON.parse(mockRedis.delayed[0].value) as {
      attempt: number;
      notBefore: number;
    };

    expect(retriedJob.attempt).toBe(2);
    expect(retriedJob.notBefore).toBe(Date.now() + PIPELINE_RETRY_BASE_DELAY_MS);

    await vi.advanceTimersByTimeAsync(PIPELINE_RETRY_BASE_DELAY_MS);

    expect(mockFetch).toHaveBeenCalledWith("https://test.formbricks.com/api/pipeline", {
      method: "POST",
      headers: {
        "x-api-key": "test-cron-secret",
      },
    });
  });

  test("moves ready delayed jobs into the pending queue before processing", async () => {
    const mockRedis = createMockRedis();

    mockGetRedisClient.mockResolvedValue(mockRedis.client);
    mockTryLock.mockResolvedValue({ ok: true, data: true });

    const queuedJob = await enqueuePipelineJob(createPipelineInput("response-delayed"));
    const serializedJob = mockRedis.pending.pop();

    expect(serializedJob).toBeDefined();

    mockRedis.delayed.push({
      score: Date.now() - 1,
      value: serializedJob!,
    });

    const processJob = vi.fn().mockResolvedValue(undefined);

    const result = await drainPipelineQueue({ processJob });

    expect(result.movedReadyJobs).toBe(1);
    expect(processJob).toHaveBeenCalledWith(expect.objectContaining({ jobId: queuedJob.jobId }));
  });

  test("logs non-2xx responses from the drain trigger endpoint", async () => {
    const mockRedis = createMockRedis();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("misconfigured cron secret", {
        status: 401,
        statusText: "Unauthorized",
      })
    );

    mockGetRedisClient.mockResolvedValue(mockRedis.client);
    mockTryLock.mockResolvedValue({ ok: true, data: true });
    vi.stubGlobal("fetch", mockFetch);

    await enqueuePipelineJob(createPipelineInput("response-1"));

    const processJob = vi.fn().mockRejectedValue(new Error("boom"));

    await drainPipelineQueue({ processJob });
    await vi.advanceTimersByTimeAsync(PIPELINE_RETRY_BASE_DELAY_MS);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        statusText: "Unauthorized",
        responseBody: "misconfigured cron secret",
      }),
      "Pipeline drain trigger returned non-2xx status"
    );
  });
});
