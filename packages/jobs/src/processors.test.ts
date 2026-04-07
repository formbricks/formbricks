import { beforeEach, describe, expect, test, vi } from "vitest";
import { JOB_NAMES } from "./constants";
import { getBackgroundJobDefinition } from "./definitions";
import { getJobProcessor, processJob } from "./processors/registry";

const { mockDebug, mockError } = vi.hoisted(() => ({
  mockDebug: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mockError,
    info: vi.fn(),
    warn: vi.fn(),
    debug: mockDebug,
  },
}));

describe("@formbricks/jobs processor registry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns registered processors", () => {
    expect(getJobProcessor(JOB_NAMES.testLog)).toBeDefined();
    expect(getJobProcessor(JOB_NAMES.responsePipeline)).toBeDefined();
    expect(getBackgroundJobDefinition(JOB_NAMES.testLog)).toBeDefined();
  });

  test("dispatches test log jobs", async () => {
    await processJob({
      attemptsMade: 0,
      data: { message: "processor test" },
      id: "job-1",
      name: JOB_NAMES.testLog,
      queueName: "background-jobs",
    } as never);

    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        jobId: "job-1",
        jobName: JOB_NAMES.testLog,
      }),
      "processor test"
    );
  });

  test("throws for unknown jobs", async () => {
    await expect(
      processJob({
        attemptsMade: 0,
        data: {},
        id: "job-2",
        name: "unknown.job",
        queueName: "background-jobs",
      } as never)
    ).rejects.toThrow("No BullMQ processor registered for job: unknown.job");

    expect(mockError).toHaveBeenCalled();
  });
});
