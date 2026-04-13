import { beforeEach, describe, expect, test, vi } from "vitest";

const TEST_TIMEOUT_MS = 15_000;

describe("jobs runtime config", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test(
    "defaults to one worker with concurrency one outside tests",
    async () => {
      vi.doMock("@/lib/env", () => ({
        env: {
          BULLMQ_EXTERNAL_WORKER_ENABLED: undefined,
          BULLMQ_WORKER_CONCURRENCY: undefined,
          BULLMQ_WORKER_COUNT: undefined,
          BULLMQ_WORKER_ENABLED: undefined,
          NODE_ENV: "development",
          REDIS_URL: "redis://localhost:6379",
        },
      }));

      const { getJobsQueueingConfig, getJobsWorkerBootstrapConfig } = await import("./config");

      expect(getJobsWorkerBootstrapConfig()).toEqual({
        enabled: true,
        runtimeOptions: {
          concurrency: 1,
          redisUrl: "redis://localhost:6379",
          workerCount: 1,
        },
      });
      expect(getJobsQueueingConfig()).toEqual({
        enabled: true,
        redisUrl: "redis://localhost:6379",
      });
    },
    TEST_TIMEOUT_MS
  );

  test(
    "disables the worker by default in tests",
    async () => {
      vi.doMock("@/lib/env", () => ({
        env: {
          BULLMQ_EXTERNAL_WORKER_ENABLED: undefined,
          BULLMQ_WORKER_CONCURRENCY: undefined,
          BULLMQ_WORKER_COUNT: undefined,
          BULLMQ_WORKER_ENABLED: undefined,
          NODE_ENV: "test",
          REDIS_URL: undefined,
        },
      }));

      const { getJobsQueueingConfig, getJobsWorkerBootstrapConfig } = await import("./config");

      expect(getJobsWorkerBootstrapConfig()).toEqual({
        enabled: false,
        runtimeOptions: null,
      });
      expect(getJobsQueueingConfig()).toEqual({
        enabled: false,
        redisUrl: null,
      });
    },
    TEST_TIMEOUT_MS
  );

  test(
    "uses explicit worker tuning overrides",
    async () => {
      vi.doMock("@/lib/env", () => ({
        env: {
          BULLMQ_EXTERNAL_WORKER_ENABLED: undefined,
          BULLMQ_WORKER_CONCURRENCY: 6,
          BULLMQ_WORKER_COUNT: 3,
          BULLMQ_WORKER_ENABLED: "1",
          NODE_ENV: "production",
          REDIS_URL: "redis://cache.internal:6379",
        },
      }));

      const { getJobsQueueingConfig, getJobsWorkerBootstrapConfig } = await import("./config");

      expect(getJobsWorkerBootstrapConfig()).toEqual({
        enabled: true,
        runtimeOptions: {
          concurrency: 6,
          redisUrl: "redis://cache.internal:6379",
          workerCount: 3,
        },
      });
      expect(getJobsQueueingConfig()).toEqual({
        enabled: true,
        redisUrl: "redis://cache.internal:6379",
      });
    },
    TEST_TIMEOUT_MS
  );

  test(
    "disables queueing when no BullMQ consumer is configured",
    async () => {
      vi.doMock("@/lib/env", () => ({
        env: {
          BULLMQ_EXTERNAL_WORKER_ENABLED: undefined,
          BULLMQ_WORKER_CONCURRENCY: 6,
          BULLMQ_WORKER_COUNT: 3,
          BULLMQ_WORKER_ENABLED: "0",
          NODE_ENV: "production",
          REDIS_URL: "redis://cache.internal:6379",
        },
      }));

      const { getJobsQueueingConfig, getJobsWorkerBootstrapConfig } = await import("./config");

      expect(getJobsWorkerBootstrapConfig()).toEqual({
        enabled: false,
        runtimeOptions: null,
      });
      expect(getJobsQueueingConfig()).toEqual({
        enabled: false,
        redisUrl: null,
      });
    },
    TEST_TIMEOUT_MS
  );

  test(
    "keeps queueing enabled when an external BullMQ worker is configured",
    async () => {
      vi.doMock("@/lib/env", () => ({
        env: {
          BULLMQ_EXTERNAL_WORKER_ENABLED: "1",
          BULLMQ_WORKER_CONCURRENCY: 6,
          BULLMQ_WORKER_COUNT: 3,
          BULLMQ_WORKER_ENABLED: "0",
          NODE_ENV: "production",
          REDIS_URL: "redis://cache.internal:6379",
        },
      }));

      const { getJobsQueueingConfig, getJobsWorkerBootstrapConfig } = await import("./config");

      expect(getJobsWorkerBootstrapConfig()).toEqual({
        enabled: false,
        runtimeOptions: null,
      });
      expect(getJobsQueueingConfig()).toEqual({
        enabled: true,
        redisUrl: "redis://cache.internal:6379",
      });
    },
    TEST_TIMEOUT_MS
  );

  test(
    "throws when the worker is enabled without a redis url",
    async () => {
      vi.doMock("@/lib/env", () => ({
        env: {
          BULLMQ_EXTERNAL_WORKER_ENABLED: undefined,
          BULLMQ_WORKER_CONCURRENCY: 2,
          BULLMQ_WORKER_COUNT: 1,
          BULLMQ_WORKER_ENABLED: "1",
          NODE_ENV: "production",
          REDIS_URL: undefined,
        },
      }));

      const { getJobsWorkerBootstrapConfig } = await import("./config");

      expect(() => getJobsWorkerBootstrapConfig()).toThrow(
        "REDIS_URL is required to start the BullMQ worker"
      );
    },
    TEST_TIMEOUT_MS
  );
});
