import { describe, expect, test } from "vitest";
import * as jobs from "./index";

describe("@formbricks/jobs public API", () => {
  test("exports the supported public entry points without leaking registry internals", () => {
    expect(jobs.enqueueTestLogJob).toBeTypeOf("function");
    expect(jobs.enqueueResponsePipelineJob).toBeTypeOf("function");
    expect(jobs.getBackgroundJobProducer).toBeTypeOf("function");
    expect(jobs.startJobsRuntime).toBeTypeOf("function");
    expect(jobs.getBackgroundJobDefinition).toBeTypeOf("function");
    expect(jobs.ZResponsePipelineEvent).toBeDefined();
    expect(jobs.ZResponsePipelineJobData).toBeDefined();
    expect(jobs.ZTestLogJobData).toBeDefined();
    expect("getJobProcessor" in jobs).toBe(false);
    expect("jobProcessors" in jobs).toBe(false);
    expect("processJob" in jobs).toBe(false);
  });
});
