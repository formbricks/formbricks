import { beforeEach, describe, expect, test, vi } from "vitest";
import { JOB_NAMES } from "./constants";
import { getBackgroundJobDefinition } from "./definitions";
import type { JobExecutionContext, TResponsePipelineJobData } from "./index";
import { getJobProcessor, processJob } from "./processors/registry";

const { mockDebug, mockError, mockWarn } = vi.hoisted(() => ({
  mockDebug: vi.fn(),
  mockError: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mockError,
    info: vi.fn(),
    warn: mockWarn,
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

  test("fails fast for the unimplemented workflow run processor", async () => {
    await expect(
      processJob({
        attemptsMade: 0,
        data: {
          workflowRunId: "cm8cmpnjj000108jfdr9wrun1",
          workflowId: "cm8cmpnjj000108jfdr9wflo1",
          workspaceId: "cm8cmpnjj000108jfdr9wksp1",
        },
        id: "job-wf",
        name: JOB_NAMES.workflowRun,
        opts: { attempts: 1 },
        queueName: "background-jobs",
      } as never)
    ).rejects.toThrow("BullMQ workflow run processor override missing");

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowRunId: "cm8cmpnjj000108jfdr9wrun1",
        workflowId: "cm8cmpnjj000108jfdr9wflo1",
        workspaceId: "cm8cmpnjj000108jfdr9wksp1",
        jobId: "job-wf",
        jobName: JOB_NAMES.workflowRun,
      }),
      "BullMQ workflow run processor override is not registered"
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

  // One factory backs all three recurring fallbacks, so they are covered together — survey-archive-purge
  // and workflow-run.reconcile previously had no test at all.
  test.each([
    [JOB_NAMES.surveyArchivePurge, "survey archive purge"],
    [JOB_NAMES.surveyScheduling, "survey scheduling"],
    [JOB_NAMES.workflowRunReconcile, "workflow run reconcile"],
  ])("fails fast for the unimplemented %s processor", async (jobName, label) => {
    await expect(
      processJob({
        attemptsMade: 0,
        data: { scope: "global" },
        id: `job-${jobName}`,
        name: jobName,
        opts: { attempts: 3 },
        queueName: "background-jobs",
      } as never)
    ).rejects.toThrow(`BullMQ ${label} processor override missing`);

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: `job-${jobName}`,
        jobName,
        scope: "global",
      }),
      `BullMQ ${label} processor override is not registered`
    );
  });

  // ENG-2235: a schedule outliving its code is an operational fact, not a retriable error. Throwing here
  // meant a rollback produced a failure every tick, forever.
  test("logs and drops unknown jobs instead of throwing", async () => {
    await expect(
      processJob({
        attemptsMade: 0,
        data: { some: "payload" },
        id: "job-2",
        name: "unknown.job",
        opts: { attempts: 3 },
        queueName: "background-jobs",
      } as never)
    ).resolves.toBeUndefined();

    expect(mockWarn).toHaveBeenCalledWith(
      { jobId: "job-2", jobName: "unknown.job", queueName: "background-jobs" },
      "Dropping BullMQ job with no registered processor: its schedule outlived the code that handled it"
    );
    // The payload of an unknown job is unvalidated and may hold real data, so it must never be logged.
    expect(mockWarn.mock.calls[0]?.[0]).not.toHaveProperty("some");
    expect(mockError).not.toHaveBeenCalled();
  });

  test("still throws when a known job's payload fails validation", async () => {
    await expect(
      processJob({
        attemptsMade: 0,
        data: { scope: "not-a-valid-scope" },
        id: "job-invalid",
        name: JOB_NAMES.surveyScheduling,
        opts: { attempts: 3 },
        queueName: "background-jobs",
      } as never)
    ).rejects.toThrow();

    expect(mockWarn).not.toHaveBeenCalled();
  });
});
