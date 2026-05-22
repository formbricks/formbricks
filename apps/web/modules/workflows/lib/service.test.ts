import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { enqueueWorkflowRunJob } from "@formbricks/jobs";
import { createDefaultWorkflowDefinition } from "./default-workflow";
import {
  enqueueResponseCompletedWorkflowRuns,
  enqueueResponseCompletedWorkflowRunsSafely,
  processWorkflowRun,
} from "./service";

const { mockLoggerError } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    workflow: {
      findMany: vi.fn(),
    },
    workflowRun: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/jobs", () => ({
  enqueueWorkflowRunJob: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mockLoggerError,
  },
}));

const workspaceId = "cm8cmpnjj000108jfdr9dfqe8";
const surveyId = "cm8cmpnjj000108jfdr9dfqe7";
const responseId = "cm8cmpnjj000108jfdr9dfqe6";
const workflowId = "cm8cmpnjj000108jfdr9dfqe5";
const workflowRunId = "cm8cmpnjj000108jfdr9dfqe4";

const response = {
  contact: null,
  contactAttributes: null,
  createdAt: new Date("2026-04-07T10:00:00.000Z"),
  data: {},
  displayId: null,
  endingId: null,
  finished: true,
  id: responseId,
  language: null,
  meta: {},
  singleUseId: null,
  surveyId,
  tags: [],
  updatedAt: new Date("2026-04-07T10:00:00.000Z"),
  variables: {},
};

const workflow = {
  createdAt: new Date("2026-04-07T10:00:00.000Z"),
  createdBy: null,
  description: null,
  definition: createDefaultWorkflowDefinition(),
  id: workflowId,
  name: "Response completed workflow",
  status: "enabled",
  updatedAt: new Date("2026-04-07T10:00:00.000Z"),
  workspaceId,
};

describe("workflow service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates queued runs and enqueues jobs for enabled matching response-completed workflows", async () => {
    vi.mocked(prisma.workflow.findMany).mockResolvedValue([workflow] as never);
    vi.mocked(prisma.workflowRun.create).mockResolvedValue({
      ...workflow,
      id: workflowRunId,
      workflowId,
      triggerPayload: {},
    } as never);
    vi.mocked(enqueueWorkflowRunJob).mockResolvedValue({ id: "job-1" } as never);

    const runs = await enqueueResponseCompletedWorkflowRuns({ workspaceId, surveyId, response });

    expect(prisma.workflow.findMany).toHaveBeenCalledWith({
      where: {
        status: "enabled",
        workspaceId,
      },
    });
    expect(prisma.workflowRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          responseId,
          status: "queued",
          surveyId,
          triggerEvent: "response.completed",
          workflowId,
          workspaceId,
        }),
      })
    );
    expect(enqueueWorkflowRunJob).toHaveBeenCalledWith({ workflowId, workflowRunId, workspaceId });
    expect(runs).toHaveLength(1);
  });

  test("does not enqueue when the trigger survey filter does not match", async () => {
    vi.mocked(prisma.workflow.findMany).mockResolvedValue([
      {
        ...workflow,
        definition: {
          ...createDefaultWorkflowDefinition(),
          trigger: {
            ...createDefaultWorkflowDefinition().trigger,
            config: {
              type: "response.completed",
              surveyId: "cm8cmpnjj000108jfdr9dfqe3",
            },
          },
        },
      },
    ] as never);

    const runs = await enqueueResponseCompletedWorkflowRuns({ workspaceId, surveyId, response });

    expect(runs).toEqual([]);
    expect(prisma.workflowRun.create).not.toHaveBeenCalled();
    expect(enqueueWorkflowRunJob).not.toHaveBeenCalled();
  });

  test("safe enqueue logs and does not throw", async () => {
    vi.mocked(prisma.workflow.findMany).mockRejectedValue(new Error("database unavailable"));

    await expect(
      enqueueResponseCompletedWorkflowRunsSafely({
        workspaceId,
        surveyId,
        response,
        logContext: { jobId: "job-response" },
      })
    ).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-response",
      }),
      "Response Completed workflow enqueue failed"
    );
  });

  test("processes workflow runs through running and completed statuses", async () => {
    vi.mocked(prisma.workflowRun.findFirst).mockResolvedValue({
      ...workflow,
      data: { steps: [], logs: [] },
      id: workflowRunId,
      triggerPayload: {
        event: "response.completed",
        response,
        surveyId,
        workspaceId,
      },
      workflow,
      workflowId,
    } as never);
    vi.mocked(prisma.workflowRun.updateMany).mockResolvedValue({ count: 1 } as never);

    await processWorkflowRun({ workflowId, workflowRunId, workspaceId });

    expect(prisma.workflowRun.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          status: "running",
        }),
        where: {
          id: workflowRunId,
          workflowId,
          workspaceId,
        },
      })
    );
    expect(prisma.workflowRun.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          status: "completed",
        }),
        where: {
          id: workflowRunId,
          workflowId,
          workspaceId,
        },
      })
    );
  });

  test("marks workflow runs failed when execution fails", async () => {
    vi.mocked(prisma.workflowRun.findFirst).mockResolvedValue({
      ...workflow,
      data: { steps: [], logs: [] },
      id: workflowRunId,
      triggerPayload: {},
      workflow: {
        ...workflow,
        definition: { schemaVersion: 1 },
      },
      workflowId,
    } as never);
    vi.mocked(prisma.workflowRun.updateMany).mockResolvedValue({ count: 1 } as never);

    await expect(processWorkflowRun({ workflowId, workflowRunId, workspaceId })).rejects.toThrow();

    expect(prisma.workflowRun.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
        }),
        where: {
          id: workflowRunId,
          workflowId,
          workspaceId,
        },
      })
    );
  });
});
