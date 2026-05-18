import { describe, expect, test } from "vitest";
import * as jobs from "./index";

describe("@formbricks/jobs public API", () => {
  test("exports the supported public entry points without leaking registry internals", () => {
    expect(jobs.enqueueTestLogJob).toBeTypeOf("function");
    expect(jobs.enqueueResponsePipelineJob).toBeTypeOf("function");
    expect(jobs.getBackgroundJobProducer).toBeTypeOf("function");
    expect(jobs.startJobsRuntime).toBeTypeOf("function");
    expect(jobs.ZResponsePipelineEvent).toBeDefined();
    expect(jobs.ZResponsePipelineJobData).toBeDefined();
    expect(jobs.ZSurveySchedulingJobData).toBeDefined();
    expect(jobs.ZTestLogJobData).toBeDefined();
    expect("JOB_NAMES" in jobs).toBe(false);
    expect("JOBS_DEFAULT_JOB_OPTIONS" in jobs).toBe(false);
    expect("JOBS_PREFIX" in jobs).toBe(false);
    expect("JOBS_QUEUE_NAME" in jobs).toBe(false);
    expect("closeRedisConnection" in jobs).toBe(false);
    expect("createProducerConnection" in jobs).toBe(false);
    expect("createWorkerConnection" in jobs).toBe(false);
    expect("getRedisUrlFromEnv" in jobs).toBe(false);
    expect("backgroundJobDefinitions" in jobs).toBe(false);
    expect("getBackgroundJobDefinition" in jobs).toBe(false);
    expect("createJobsQueue" in jobs).toBe(false);
    expect("getJobsQueue" in jobs).toBe(false);
    expect("resetJobsQueueFactory" in jobs).toBe(false);
    expect("getJobProcessor" in jobs).toBe(false);
    expect("jobProcessors" in jobs).toBe(false);
    expect("processJob" in jobs).toBe(false);
  });
});
