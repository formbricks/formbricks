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

  test("fails fast for the unimplemented response pipeline processor", async () => {
    await expect(
      processJob({
        attemptsMade: 0,
        data: {
          environmentId: "env_123",
          event: "responseCreated",
          response: {
            contact: null,
            contactAttributes: null,
            createdAt: new Date("2026-04-07T10:00:00.000Z"),
            data: {},
            displayId: null,
            endingId: null,
            finished: false,
            id: "cm8cmpnjj000108jfdr9dfqe6",
            language: null,
            meta: {},
            singleUseId: null,
            surveyId: "cm8cmpnjj000108jfdr9dfqe7",
            tags: [],
            updatedAt: new Date("2026-04-07T10:00:00.000Z"),
            variables: {},
          },
          surveyId: "survey_123",
        },
        id: "job-3",
        name: JOB_NAMES.responsePipeline,
        queueName: "background-jobs",
      } as never)
    ).rejects.toThrow("BullMQ response pipeline processor override missing");

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        environmentId: "env_123",
        jobId: "job-3",
        jobName: JOB_NAMES.responsePipeline,
        surveyId: "survey_123",
      }),
      "BullMQ response pipeline processor override is not registered"
    );
  });

  test("uses registered handler overrides when provided", async () => {
    const overrideHandler = vi.fn().mockResolvedValue(undefined);
    const job = {
      attemptsMade: 0,
      data: {
        environmentId: "env_123",
        event: "responseCreated",
        response: {
          contact: null,
          contactAttributes: null,
          createdAt: new Date("2026-04-07T10:00:00.000Z"),
          data: {},
          displayId: null,
          endingId: null,
          finished: false,
          id: "cm8cmpnjj000108jfdr9dfqe6",
          language: null,
          meta: {},
          singleUseId: null,
          surveyId: "cm8cmpnjj000108jfdr9dfqe7",
          tags: [],
          updatedAt: new Date("2026-04-07T10:00:00.000Z"),
          variables: {},
        },
        surveyId: "survey_123",
      },
      id: "job-override",
      name: JOB_NAMES.responsePipeline,
      queueName: "background-jobs",
    } as never;

    await expect(
      processJob(job, {
        [JOB_NAMES.responsePipeline]: overrideHandler,
      })
    ).resolves.toBeUndefined();

    expect(overrideHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        environmentId: "env_123",
        surveyId: "survey_123",
      }),
      {
        attempt: 1,
        jobId: "job-override",
        jobName: JOB_NAMES.responsePipeline,
        queueName: "background-jobs",
      }
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
