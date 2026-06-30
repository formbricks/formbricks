import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TWorkflowRunJobData } from "@formbricks/jobs";
import { processWorkflowRunJob } from "./process-workflow-run-job";

const {
  mockSendEmail,
  mockLoggerError,
  mockLoggerInfo,
  mockLoggerWarn,
  mockWorkflowRunFindFirst,
  mockWorkflowRunUpdateMany,
  mockWorkflowRunLogCreate,
  mockWorkflowRunLogFindMany,
} = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockWorkflowRunFindFirst: vi.fn(),
  mockWorkflowRunUpdateMany: vi.fn(),
  mockWorkflowRunLogCreate: vi.fn(),
  mockWorkflowRunLogFindMany: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    workflowRun: {
      findFirst: mockWorkflowRunFindFirst,
      updateMany: mockWorkflowRunUpdateMany,
    },
    workflowRunLog: {
      create: mockWorkflowRunLogCreate,
      findMany: mockWorkflowRunLogFindMany,
    },
  },
}));

vi.mock("@/modules/email", () => ({
  sendEmail: mockSendEmail,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: mockLoggerError,
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
  },
}));

const triggerPayload = {
  type: "response.completed" as const,
  workspaceId: "cm9zr4wsp000508l8y6nh9r2v",
  surveyId: "cm9zr4mps000008l8btfy1vtz",
  responseId: "cm9zr4rsp000708l8bqccpfrx",
  endingCardId: "cm9zr4q7i000108l84gozfggr",
  data: { response: { email: "jane@example.com", score: 9 } },
  triggeredAt: "2026-06-09T12:01:00.000Z",
};

const executableDefinition = {
  schemaVersion: 1,
  entryNodeId: "trigger",
  trigger: {
    id: "trigger",
    type: "trigger",
    triggerType: "response.completed",
    config: { surveyId: "cm9zr4mps000008l8btfy1vtz", endingCardIds: [] },
  },
  nodes: [
    {
      id: "send-email",
      type: "action",
      actionType: "send_email",
      label: "Send thank you email",
      config: {
        to: "{{response.email}}",
        from: "noreply@example.com",
        replyTo: ["support@example.com"],
        subject: "Thanks for your response",
        body: "We received your response.",
        attachResponseData: true,
        includeVariables: true,
        includeHiddenFields: true,
      },
    },
  ],
  edges: [{ id: "trigger-send-email", source: "trigger", target: "send-email" }],
};

const baseRun = {
  id: "cm9zr4run000908l8q9b9d3pm",
  status: "queued",
  attempt: 0,
  triggerPayload,
  workflowVersion: { definition: executableDefinition },
  workflow: { definition: executableDefinition },
};

const data: TWorkflowRunJobData = {
  workflowRunId: "cm9zr4run000908l8q9b9d3pm",
  workflowId: "cm9zr4wfl000008l8q9b9d3pm",
  workspaceId: "cm9zr4wsp000508l8y6nh9r2v",
};

const baseContext = {
  attempt: 1,
  jobId: "job_123",
  jobName: "workflow-run.process",
  maxAttempts: 3,
  queueName: "background-jobs",
};

const finalAttemptContext = { ...baseContext, attempt: baseContext.maxAttempts };

describe("processWorkflowRunJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkflowRunFindFirst.mockResolvedValue(baseRun);
    mockWorkflowRunUpdateMany.mockResolvedValue({ count: 1 });
    mockWorkflowRunLogCreate.mockResolvedValue(undefined);
    mockWorkflowRunLogFindMany.mockResolvedValue([]);
    mockSendEmail.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("loads the run scoped to the job's workspace", async () => {
    await processWorkflowRunJob(data, baseContext);

    expect(mockWorkflowRunFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: data.workflowRunId, workspaceId: data.workspaceId },
      })
    );
  });

  test("executes a send_email run end-to-end and completes it", async () => {
    await expect(processWorkflowRunJob(data, baseContext)).resolves.toBeUndefined();

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        from: "noreply@example.com",
        replyTo: "support@example.com",
        subject: "Thanks for your response",
        html: expect.any(String),
        text: expect.any(String),
      })
    );

    // queued -> running claim is a workspace-scoped conditional updateMany
    expect(mockWorkflowRunUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: baseRun.id, workspaceId: data.workspaceId, status: { in: ["queued"] } },
        data: expect.objectContaining({ status: "running", startedAt: expect.any(Date) }),
      })
    );
    const completion = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(completion.where).toEqual({ id: baseRun.id, workspaceId: data.workspaceId });
    expect(completion.data.status).toBe("completed");
    expect(completion.data.finishedAt).toBeInstanceOf(Date);
    expect(completion.data.data.steps).toHaveLength(1);
    expect(completion.data.data.steps[0]).toMatchObject({
      stepId: "send-email",
      stepType: "send_email",
      status: "succeeded",
      output: { provider: "smtp", messageId: expect.any(String) },
    });
  });

  test("writes a WorkflowRunLog row per executed step", async () => {
    await processWorkflowRunJob(data, baseContext);

    expect(mockWorkflowRunLogCreate).toHaveBeenCalledTimes(1);
    expect(mockWorkflowRunLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          runId: baseRun.id,
          sequence: 1,
          stepId: "send-email",
          stepType: "send_email",
          status: "succeeded",
          output: { provider: "smtp", messageId: expect.any(String) },
        }),
      })
    );
  });

  test("no-ops on a run that is already terminal (replay safe)", async () => {
    mockWorkflowRunFindFirst.mockResolvedValue({ ...baseRun, status: "completed" });

    await expect(processWorkflowRunJob(data, baseContext)).resolves.toBeUndefined();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockWorkflowRunUpdateMany).not.toHaveBeenCalled();
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
      "Workflow run already terminal; skipping"
    );
  });

  test("drops the job when the run cannot be found for the workspace", async () => {
    mockWorkflowRunFindFirst.mockResolvedValue(null);

    await expect(processWorkflowRunJob(data, baseContext)).resolves.toBeUndefined();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockWorkflowRunUpdateMany).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.any(Object),
      "Workflow run not found for workspace; dropping job"
    );
  });

  test("returns without double-processing when the queued -> running claim loses the race", async () => {
    mockWorkflowRunUpdateMany.mockResolvedValue({ count: 0 });

    await expect(processWorkflowRunJob(data, baseContext)).resolves.toBeUndefined();

    expect(mockSendEmail).not.toHaveBeenCalled();
    // Only the claim attempt ran; no completion write.
    expect(mockWorkflowRunUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.any(Object),
      "Workflow run already claimed by another delivery; skipping"
    );
  });

  test("falls back to the workflow definition when no version snapshot exists", async () => {
    mockWorkflowRunFindFirst.mockResolvedValue({ ...baseRun, workflowVersion: null });

    await expect(processWorkflowRunJob(data, baseContext)).resolves.toBeUndefined();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  test("does NOT re-send a step that already has a succeeded log (retry resumes)", async () => {
    // Simulate a retry: the run is mid-flight (running) and the first step already succeeded.
    mockWorkflowRunFindFirst.mockResolvedValue({ ...baseRun, status: "running" });
    mockWorkflowRunUpdateMany.mockResolvedValue({ count: 0 });
    mockWorkflowRunLogFindMany.mockResolvedValue([
      {
        stepId: "send-email",
        stepType: "send_email",
        input: { to: "jane@example.com", subject: "Thanks for your response" },
        output: { provider: "smtp", messageId: "deadbeef" },
        startedAt: new Date("2026-06-09T12:01:00.000Z"),
        finishedAt: new Date("2026-06-09T12:01:01.000Z"),
      },
    ]);

    await expect(processWorkflowRunJob(data, baseContext)).resolves.toBeUndefined();

    expect(mockSendEmail).not.toHaveBeenCalled();
    // No duplicate log row written for the already-succeeded step.
    expect(mockWorkflowRunLogCreate).not.toHaveBeenCalled();
    const completion = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(completion.data.status).toBe("completed");
    expect(completion.data.data.steps[0]).toMatchObject({
      stepId: "send-email",
      status: "succeeded",
      output: { provider: "smtp", messageId: "deadbeef" },
    });
  });

  test("marks the step + run failed for an invalid resolved recipient and never calls sendEmail", async () => {
    mockWorkflowRunFindFirst.mockResolvedValue({
      ...baseRun,
      triggerPayload: { ...triggerPayload, data: { response: { email: "not-an-email" } } },
    });

    await expect(processWorkflowRunJob(data, baseContext)).rejects.toThrow(/not a valid address/);

    expect(mockSendEmail).not.toHaveBeenCalled();
    const failure = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(failure.where).toEqual({ id: baseRun.id, workspaceId: data.workspaceId });
    expect(failure.data.status).toBe("failed");
    expect(failure.data.data.steps[0]).toMatchObject({
      status: "failed",
      error: "Resolved email recipient is not a valid address",
    });
  });

  test("marks the run failed and rethrows when SMTP is not configured (sendEmail returns false)", async () => {
    mockSendEmail.mockResolvedValue(false);

    await expect(processWorkflowRunJob(data, baseContext)).rejects.toThrow(/SMTP is not configured/);

    const failure = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(failure.data.status).toBe("failed");
    expect(failure.data.error).toMatch(/SMTP is not configured/);
    expect(failure.data.lastErrorAt).toBeInstanceOf(Date);
    expect(failure.data.finishedAt).toBeInstanceOf(Date);
    expect(failure.data.data.steps[0]).toMatchObject({ status: "failed" });
  });

  test("marks the run failed when sendEmail throws", async () => {
    mockSendEmail.mockRejectedValue(new Error("SMTP provider rejected the message"));

    await expect(processWorkflowRunJob(data, baseContext)).rejects.toThrow(/SMTP provider rejected/);

    const failure = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(failure.data.status).toBe("failed");
    expect(failure.data.data.steps[0]).toMatchObject({
      status: "failed",
      error: "SMTP provider rejected the message",
    });
  });

  test("marks the run failed for an invalid / non-executable definition", async () => {
    mockWorkflowRunFindFirst.mockResolvedValue({
      ...baseRun,
      workflowVersion: { definition: { not: "a workflow" } },
      workflow: { definition: { not: "a workflow" } },
    });

    await expect(processWorkflowRunJob(data, baseContext)).rejects.toThrow(/not executable/);

    expect(mockSendEmail).not.toHaveBeenCalled();
    const failure = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(failure.data.status).toBe("failed");
  });

  test("swallows the failure on the final attempt after recording it", async () => {
    mockSendEmail.mockRejectedValue(new Error("SMTP provider rejected the message"));

    await expect(processWorkflowRunJob(data, finalAttemptContext)).resolves.toBeUndefined();

    const failure = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(failure.data.status).toBe("failed");
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      "Workflow run job failed after final attempt"
    );
  });

  test("rethrows a transient DB pool exhaustion so BullMQ retries (no failed status persisted)", async () => {
    mockWorkflowRunUpdateMany.mockImplementation(({ data: updateData }: { data: { status: string } }) => {
      if (updateData.status === "running") {
        return Promise.reject(new Error("Timed out fetching a new connection from the connection pool"));
      }
      return Promise.resolve({ count: 1 });
    });

    await expect(processWorkflowRunJob(data, baseContext)).rejects.toThrow(/connection pool/i);

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      "Workflow run job hit database pool exhaustion; will retry"
    );
    const statuses = mockWorkflowRunUpdateMany.mock.calls.map((call) => call[0].data.status);
    expect(statuses).not.toContain("failed");
  });
});
