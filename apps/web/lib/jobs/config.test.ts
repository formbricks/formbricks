import { beforeEach, describe, expect, test, vi } from "vitest";

describe("jobs runtime config", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("defaults to one worker with concurrency one outside tests", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        BULLMQ_WORKER_CONCURRENCY: undefined,
        BULLMQ_WORKER_COUNT: undefined,
        BULLMQ_WORKER_ENABLED: undefined,
        NODE_ENV: "development",
        REDIS_URL: "redis://localhost:6379",
      },
    }));

    const { getJobsWorkerBootstrapConfig } = await import("./config");

    expect(getJobsWorkerBootstrapConfig()).toEqual({
      enabled: true,
      runtimeOptions: {
        concurrency: 1,
        redisUrl: "redis://localhost:6379",
        workerCount: 1,
      },
    });
  });

  test("disables the worker by default in tests", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        BULLMQ_WORKER_CONCURRENCY: undefined,
        BULLMQ_WORKER_COUNT: undefined,
        BULLMQ_WORKER_ENABLED: undefined,
        NODE_ENV: "test",
        REDIS_URL: undefined,
      },
    }));

    const { getJobsWorkerBootstrapConfig } = await import("./config");

    expect(getJobsWorkerBootstrapConfig()).toEqual({
      enabled: false,
      runtimeOptions: null,
    });
  });

  test("uses explicit worker tuning overrides", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        BULLMQ_WORKER_CONCURRENCY: 6,
        BULLMQ_WORKER_COUNT: 3,
        BULLMQ_WORKER_ENABLED: "1",
        NODE_ENV: "production",
        REDIS_URL: "redis://cache.internal:6379",
      },
    }));

    const { getJobsWorkerBootstrapConfig } = await import("./config");

    expect(getJobsWorkerBootstrapConfig()).toEqual({
      enabled: true,
      runtimeOptions: {
        concurrency: 6,
        redisUrl: "redis://cache.internal:6379",
        workerCount: 3,
      },
    });
  });

  test("respects explicit worker disable flag outside tests", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        BULLMQ_WORKER_CONCURRENCY: 6,
        BULLMQ_WORKER_COUNT: 3,
        BULLMQ_WORKER_ENABLED: "0",
        NODE_ENV: "production",
        REDIS_URL: "redis://cache.internal:6379",
      },
    }));

    const { getJobsWorkerBootstrapConfig } = await import("./config");

    expect(getJobsWorkerBootstrapConfig()).toEqual({
      enabled: false,
      runtimeOptions: null,
    });
  });
});
