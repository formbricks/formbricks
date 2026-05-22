import { beforeEach, describe, expect, test, vi } from "vitest";
import { JOB_NAMES } from "./constants";
import { getBackgroundJobDefinition } from "./definitions";
import type { JobExecutionContext, TResponsePipelineJobData } from "./index";
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
    expect(getJobProcessor(JOB_NAMES.surveyScheduling)).toBeDefined();
    expect(getJobProcessor(JOB_NAMES.workflowRun)).toBeDefined();
    expect(getBackgroundJobDefinition(JOB_NAMES.testLog)).toBeDefined();
  });

  test("dispatches test log jobs", async () => {
    await processJob({
      attemptsMade: 0,
      data: { message: "processor test" },
      id: "job-1",
      name: JOB_NAMES.testLog,
      opts: { attempts: 3 },
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
          workspaceId: "cm8cmpnjj000108jfdr9dfqe8",
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
          surveyId: "cm8cmpnjj000108jfdr9dfqe7",
        },
        id: "job-3",
        name: JOB_NAMES.responsePipeline,
        opts: { attempts: 3 },
        queueName: "background-jobs",
      } as never)
    ).rejects.toThrow("BullMQ response pipeline processor override missing");

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "cm8cmpnjj000108jfdr9dfqe8",
        jobId: "job-3",
        jobName: JOB_NAMES.responsePipeline,
        surveyId: "cm8cmpnjj000108jfdr9dfqe7",
      }),
      "BullMQ response pipeline processor override is not registered"
    );
  });

  test("uses registered handler overrides when provided", async () => {
    const overrideHandler = vi.fn().mockResolvedValue(undefined);
    const job = {
      attemptsMade: 0,
      data: {
        workspaceId: "cm8cmpnjj000108jfdr9dfqe8",
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
        surveyId: "cm8cmpnjj000108jfdr9dfqe7",
      },
      id: "job-override",
      name: JOB_NAMES.responsePipeline,
      opts: { attempts: 5 },
      queueName: "background-jobs",
    } as never;

    await expect(
      processJob(job, {
        [JOB_NAMES.responsePipeline]: overrideHandler,
      })
    ).resolves.toBeUndefined();

    expect(overrideHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "cm8cmpnjj000108jfdr9dfqe8",
        surveyId: "cm8cmpnjj000108jfdr9dfqe7",
      }),
      {
        attempt: 1,
        jobId: "job-override",
        jobName: JOB_NAMES.responsePipeline,
        maxAttempts: 5,
        queueName: "background-jobs",
      }
    );
  });

  test("accepts serialized response pipeline payloads from BullMQ", async () => {
    const overrideHandler = vi.fn().mockResolvedValue(undefined);

    await expect(
      processJob(
        {
          attemptsMade: 0,
          data: {
            workspaceId: "cm8cmpnjj000108jfdr9dfqe8",
            event: "responseCreated",
            response: {
              contact: null,
              contactAttributes: null,
              createdAt: "2026-04-07T10:00:00.000Z",
              data: {},
              displayId: null,
              endingId: null,
              finished: false,
              id: "cm8cmpnjj000108jfdr9dfqe6",
              language: null,
              meta: {},
              singleUseId: null,
              surveyId: "cm8cmpnjj000108jfdr9dfqe7",
              tags: [
                {
                  createdAt: "2026-04-07T10:00:00.000Z",
                  id: "cm8cmpnjj000108jfdr9dfqe8",
                  name: "tag-1",
                  updatedAt: "2026-04-07T10:00:00.000Z",
                  workspaceId: "cm8cmpnjj000108jfdr9dfqe9",
                },
              ],
              updatedAt: "2026-04-07T10:00:00.000Z",
              variables: {},
            },
            surveyId: "cm8cmpnjj000108jfdr9dfqe7",
          },
          id: "job-serialized",
          name: JOB_NAMES.responsePipeline,
          opts: { attempts: 3 },
          queueName: "background-jobs",
        } as never,
        {
          [JOB_NAMES.responsePipeline]: overrideHandler,
        }
      )
    ).resolves.toBeUndefined();

    expect(overrideHandler).toHaveBeenCalledTimes(1);

    const firstCall = overrideHandler.mock.calls[0] as
      | [TResponsePipelineJobData, JobExecutionContext]
      | undefined;

    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error("Expected the response pipeline override handler to be called");
    }

    const [payload, context] = firstCall;
    expect(payload.response.createdAt).toEqual(new Date("2026-04-07T10:00:00.000Z"));
    expect(payload.response.updatedAt).toEqual(new Date("2026-04-07T10:00:00.000Z"));
    expect(payload.response.tags).toEqual([
      expect.objectContaining({
        createdAt: new Date("2026-04-07T10:00:00.000Z"),
        updatedAt: new Date("2026-04-07T10:00:00.000Z"),
      }),
    ]);
    expect(context).toEqual(
      expect.objectContaining({
        jobId: "job-serialized",
      })
    );
  });

  test("fails fast for the unimplemented survey scheduling processor", async () => {
    await expect(
      processJob({
        attemptsMade: 0,
        data: {
          scope: "global",
        },
        id: "job-survey-scheduling",
        name: JOB_NAMES.surveyScheduling,
        opts: { attempts: 3 },
        queueName: "background-jobs",
      } as never)
    ).rejects.toThrow("BullMQ survey scheduling processor override missing");

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-survey-scheduling",
        jobName: JOB_NAMES.surveyScheduling,
        scope: "global",
      }),
      "BullMQ survey scheduling processor override is not registered"
    );
  });

  test("fails fast for the unimplemented workflow run processor", async () => {
    await expect(
      processJob({
        attemptsMade: 0,
        data: {
          workflowId: "cm8cmpnjj000108jfdr9dfqe5",
          workflowRunId: "cm8cmpnjj000108jfdr9dfqe4",
          workspaceId: "cm8cmpnjj000108jfdr9dfqe8",
        },
        id: "job-workflow-run",
        name: JOB_NAMES.workflowRun,
        opts: { attempts: 1 },
        queueName: "background-jobs",
      } as never)
    ).rejects.toThrow("BullMQ workflow run processor override missing");

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-workflow-run",
        jobName: JOB_NAMES.workflowRun,
        workflowRunId: "cm8cmpnjj000108jfdr9dfqe4",
        workspaceId: "cm8cmpnjj000108jfdr9dfqe8",
      }),
      "BullMQ workflow run processor override is not registered"
    );
  });

  test("uses workflow run handler overrides when provided", async () => {
    const overrideHandler = vi.fn().mockResolvedValue(undefined);

    await expect(
      processJob(
        {
          attemptsMade: 0,
          data: {
            workflowId: "cm8cmpnjj000108jfdr9dfqe5",
            workflowRunId: "cm8cmpnjj000108jfdr9dfqe4",
            workspaceId: "cm8cmpnjj000108jfdr9dfqe8",
          },
          id: "job-workflow-run-override",
          name: JOB_NAMES.workflowRun,
          opts: { attempts: 1 },
          queueName: "background-jobs",
        } as never,
        {
          [JOB_NAMES.workflowRun]: overrideHandler,
        }
      )
    ).resolves.toBeUndefined();

    expect(overrideHandler).toHaveBeenCalledWith(
      {
        workflowId: "cm8cmpnjj000108jfdr9dfqe5",
        workflowRunId: "cm8cmpnjj000108jfdr9dfqe4",
        workspaceId: "cm8cmpnjj000108jfdr9dfqe8",
      },
      {
        attempt: 1,
        jobId: "job-workflow-run-override",
        jobName: JOB_NAMES.workflowRun,
        maxAttempts: 1,
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
        opts: { attempts: 3 },
        queueName: "background-jobs",
      } as never)
    ).rejects.toThrow("No BullMQ processor registered for job: unknown.job");

    expect(mockError).toHaveBeenCalled();
  });
});
