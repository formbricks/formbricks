import { QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { JOBS_DEFAULT_JOB_OPTIONS, JOBS_PREFIX, JOBS_QUEUE_NAME, JOB_NAMES } from "./constants";
import {
  enqueueTestLogJob,
  getBackgroundJobProducer,
  resetJobsQueueFactory,
  scheduleTestLogJobAt,
} from "./queue";
import { startJobsRuntime } from "./runtime";

let redisUrl: string | undefined;
let runtime: Awaited<ReturnType<typeof startJobsRuntime>> | null = null;
let queueEvents: QueueEvents | null = null;
let queueEventsConnection: IORedis | null = null;
let isRedisAvailable = false;

async function isQueueReady(url: string): Promise<boolean> {
  let probe: Awaited<ReturnType<typeof startJobsRuntime>> | null = null;

  try {
    probe = await startJobsRuntime({ redisUrl: url });
    return true;
  } catch (error) {
    logger.info({ error }, "BullMQ integration tests skipped because Redis is not available");
    return false;
  } finally {
    if (probe) {
      try {
        await probe.close();
      } catch (error) {
        logger.warn({ err: error }, "Failed to close BullMQ runtime probe cleanly");
      }
    }
  }
}

describe("BullMQ integration tests", () => {
  beforeAll(async () => {
    redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      logger.info("BullMQ integration tests skipped because REDIS_URL is not configured");
      return;
    }

    isRedisAvailable = await isQueueReady(redisUrl);
    if (!isRedisAvailable) {
      return;
    }

    runtime = await startJobsRuntime({ redisUrl });
    queueEventsConnection = new IORedis(redisUrl, {
      connectionName: "formbricks-jobs-queue-events",
      maxRetriesPerRequest: null,
    });
    queueEvents = new QueueEvents(JOBS_QUEUE_NAME, {
      connection: queueEventsConnection,
      prefix: JOBS_PREFIX,
    });
    await queueEvents.waitUntilReady();
  });

  afterAll(async () => {
    if (queueEvents) {
      await queueEvents.close();
    }

    if (queueEventsConnection) {
      await queueEventsConnection.quit();
    }

    if (runtime) {
      await runtime.close();
    }

    await resetJobsQueueFactory();
  });

  test("processes the test log job end-to-end", async () => {
    if (!isRedisAvailable || !queueEvents) {
      logger.info("Skipping BullMQ integration test: Redis not available");
      return;
    }

    const job = await enqueueTestLogJob({ message: "integration success" });

    await expect(job.waitUntilFinished(queueEvents)).resolves.toBeUndefined();
    expect(job.name).toBe(JOB_NAMES.testLog);
    expect(job.opts.attempts).toBe(JOBS_DEFAULT_JOB_OPTIONS.attempts);
    expect(job.opts.backoff).toEqual(JOBS_DEFAULT_JOB_OPTIONS.backoff);
  }, 15000);

  test("retries and fails the test log job when instructed", async () => {
    if (!isRedisAvailable || !queueEvents) {
      logger.info("Skipping BullMQ integration test: Redis not available");
      return;
    }

    const errorSpy = vi.spyOn(logger, "error");
    const job = await enqueueTestLogJob({ message: "integration failure", shouldFail: true });

    await expect(job.waitUntilFinished(queueEvents)).rejects.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptsMade: JOBS_DEFAULT_JOB_OPTIONS.attempts,
        jobId: job.id,
        jobName: JOB_NAMES.testLog,
      }),
      "BullMQ job failed"
    );
  }, 15000);

  test("processes delayed jobs after their scheduled time", async () => {
    if (!isRedisAvailable || !queueEvents) {
      logger.info("Skipping BullMQ integration test: Redis not available");
      return;
    }

    const startedAt = Date.now();
    const job = await scheduleTestLogJobAt(
      { runAt: new Date(startedAt + 500) },
      { message: "integration delayed success" }
    );

    await expect(job.waitUntilFinished(queueEvents)).resolves.toBeUndefined();
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(250);
  }, 15000);

  test("upserts recurring schedules using the engine-neutral producer interface", async () => {
    if (!isRedisAvailable) {
      logger.info("Skipping BullMQ integration test: Redis not available");
      return;
    }

    const producer = getBackgroundJobProducer();
    const debugSpy = vi.spyOn(logger, "debug");
    const message = `integration recurring ${Date.now().toString()}`;
    const scheduleId = `integration-recurring-${Date.now().toString()}`;

    const scheduledJob = await producer.upsertRecurringTestLogSchedule(
      {
        scheduleId,
        scope: "integration-tests",
      },
      {
        everyMs: 200,
        kind: "every",
        limit: 2,
      },
      { message }
    );

    await vi.waitFor(
      () => {
        const processorLogs = debugSpy.mock.calls.filter((call) => call[1] === message);
        expect(processorLogs).toHaveLength(2);
      },
      { interval: 100, timeout: 10_000 }
    );

    expect(scheduledJob).toMatchObject({
      jobName: JOB_NAMES.testLog,
      queueName: JOBS_QUEUE_NAME,
      scheduleId,
      scope: "integration-tests",
    });
    expect(scheduledJob.jobId).toEqual(expect.any(String));
  }, 15000);
});
