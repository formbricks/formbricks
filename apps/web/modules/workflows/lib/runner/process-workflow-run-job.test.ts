import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TWorkflowRunJobData } from "@formbricks/jobs";
import { processWorkflowRunJob } from "./process-workflow-run-job";

const {
  mockSendEmail,
  mockBuildHtml,
  mockLoggerError,
  mockLoggerInfo,
  mockLoggerWarn,
  mockWorkflowRunFindFirst,
  mockWorkflowRunUpdateMany,
  mockWorkflowRunLogCreate,
  mockWorkflowRunLogFindMany,
  mockGetResponse,
  mockGetSurvey,
  mockGetOrganizationByWorkspaceId,
} = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
  mockBuildHtml: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockWorkflowRunFindFirst: vi.fn(),
  mockWorkflowRunUpdateMany: vi.fn(),
  mockWorkflowRunLogCreate: vi.fn(),
  mockWorkflowRunLogFindMany: vi.fn(),
  mockGetResponse: vi.fn(),
  mockGetSurvey: vi.fn(),
  mockGetOrganizationByWorkspaceId: vi.fn(),
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

// Keep the real recipient resolution (pure zod) so `to`-resolution is exercised end-to-end;
// only the HTML builder (i18n + render) is stubbed.
vi.mock("@/modules/email/lib/survey-response-email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/email/lib/survey-response-email")>();
  return { ...actual, buildSurveyResponseEmailHtml: mockBuildHtml };
});

vi.mock("@/lib/response/service", () => ({
  getResponse: mockGetResponse,
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: mockGetSurvey,
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByWorkspaceId: mockGetOrganizationByWorkspaceId,
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

// `to` is a question/hidden-field id resolved against the response (Follow-Ups parity).
const makeDefinition = (to = "email", overrides: Record<string, unknown> = {}) => ({
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
        to,
        from: "noreply@example.com",
        replyTo: ["support@example.com"],
        subject: "Thanks for your response",
        body: "<p>Hi #recall:name/fallback:there#</p>",
        attachResponseData: true,
        includeVariables: true,
        includeHiddenFields: true,
        ...overrides,
      },
    },
  ],
  edges: [{ id: "trigger-send-email", source: "trigger", target: "send-email" }],
});

const executableDefinition = makeDefinition();

const baseRun = {
  id: "cm9zr4run000908l8q9b9d3pm",
  status: "queued",
  attempt: 0,
  triggerPayload,
  workflowVersion: { definition: executableDefinition },
  workflow: { definition: executableDefinition },
};

const mockResponse = {
  id: "cm9zr4rsp000708l8bqccpfrx",
  surveyId: "cm9zr4mps000008l8btfy1vtz",
  data: { email: "jane@example.com", name: "Jane" },
  variables: {},
  language: "en-US",
};

const mockSurvey = { id: "cm9zr4mps000008l8btfy1vtz", blocks: [], languages: [] };

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
    mockBuildHtml.mockResolvedValue("<html>branded</html>");
    mockGetResponse.mockResolvedValue(mockResponse);
    mockGetSurvey.mockResolvedValue(mockSurvey);
    mockGetOrganizationByWorkspaceId.mockResolvedValue({ id: "org1", whitelabel: { logoUrl: "logo.png" } });
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

  test("executes a send_email run end-to-end (Follow-Ups parity) and completes it", async () => {
    await expect(processWorkflowRunJob(data, baseContext)).resolves.toBeUndefined();

    // Survey + response + org loaded once for the run.
    expect(mockGetResponse).toHaveBeenCalledWith(triggerPayload.responseId);
    expect(mockGetSurvey).toHaveBeenCalledWith(triggerPayload.surveyId);
    expect(mockGetOrganizationByWorkspaceId).toHaveBeenCalledWith(data.workspaceId);

    // Branded HTML built from the recall body + gating flags, org logo threaded in.
    expect(mockBuildHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "<p>Hi #recall:name/fallback:there#</p>",
        survey: mockSurvey,
        response: mockResponse,
        attachResponseData: true,
        includeVariables: true,
        includeHiddenFields: true,
        logoUrl: "logo.png",
        locale: "en-US",
      })
    );

    // HTML-only send (no `text`), resolved recipient, sanitized subject, stable Message-ID.
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const sendArgs = mockSendEmail.mock.calls[0][0];
    expect(sendArgs).toMatchObject({
      to: "jane@example.com",
      from: "noreply@example.com",
      replyTo: "support@example.com",
      subject: "Thanks for your response",
      html: "<html>branded</html>",
    });
    expect(sendArgs.text).toBeUndefined();
    expect(sendArgs.messageId).toMatch(/^<.+@example\.com>$/);

    const completion = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(completion.data.status).toBe("completed");
    expect(completion.data.data.steps[0]).toMatchObject({
      stepId: "send-email",
      stepType: "send_email",
      status: "succeeded",
      output: { provider: "smtp", messageId: sendArgs.messageId },
    });
  });

  test("resolves a literal-email `to` directly", async () => {
    mockWorkflowRunFindFirst.mockResolvedValue({
      ...baseRun,
      workflowVersion: { definition: makeDefinition("teammate@example.com") },
      workflow: { definition: makeDefinition("teammate@example.com") },
    });

    await processWorkflowRunJob(data, baseContext);

    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "teammate@example.com" }));
  });

  test("resolves a contact-info array `to` using index [2]", async () => {
    mockGetResponse.mockResolvedValue({
      ...mockResponse,
      data: { contact: ["Jane", "Doe", "jane@example.com", "+1"] },
    });
    mockWorkflowRunFindFirst.mockResolvedValue({
      ...baseRun,
      workflowVersion: { definition: makeDefinition("contact") },
      workflow: { definition: makeDefinition("contact") },
    });

    await processWorkflowRunJob(data, baseContext);

    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "jane@example.com" }));
  });

  test("fails the step (no send) when the recipient cannot be resolved (final attempt → failed)", async () => {
    mockGetResponse.mockResolvedValue({ ...mockResponse, data: { name: "Jane" } });

    await expect(processWorkflowRunJob(data, finalAttemptContext)).resolves.toBeUndefined();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockBuildHtml).not.toHaveBeenCalled();
    const failure = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(failure.data.status).toBe("failed");
    expect(failure.data.data.steps[0]).toMatchObject({ status: "failed" });
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

  test("fails the run when the response is missing (final attempt → failed)", async () => {
    mockGetResponse.mockResolvedValue(null);

    await expect(processWorkflowRunJob(data, finalAttemptContext)).resolves.toBeUndefined();

    expect(mockSendEmail).not.toHaveBeenCalled();
    const failure = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(failure.data.status).toBe("failed");
    expect(failure.data.error).toMatch(/Response .* not found/);
  });

  test("fails the run when the survey is missing (final attempt → failed)", async () => {
    mockGetSurvey.mockResolvedValue(null);

    await expect(processWorkflowRunJob(data, finalAttemptContext)).resolves.toBeUndefined();

    expect(mockSendEmail).not.toHaveBeenCalled();
    const failure = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(failure.data.status).toBe("failed");
    expect(failure.data.error).toMatch(/Survey .* not found/);
  });

  test("uses an empty logo url when the organization has no whitelabel logo", async () => {
    mockGetOrganizationByWorkspaceId.mockResolvedValue({ id: "org1", whitelabel: null });

    await processWorkflowRunJob(data, baseContext);

    expect(mockBuildHtml).toHaveBeenCalledWith(expect.objectContaining({ logoUrl: "" }));
  });

  test("returns without double-processing when the queued -> running claim loses the race", async () => {
    mockWorkflowRunUpdateMany.mockResolvedValue({ count: 0 });

    await expect(processWorkflowRunJob(data, baseContext)).resolves.toBeUndefined();

    expect(mockSendEmail).not.toHaveBeenCalled();
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
    mockWorkflowRunFindFirst.mockResolvedValue({ ...baseRun, status: "running" });
    mockWorkflowRunUpdateMany.mockResolvedValue({ count: 0 });
    mockWorkflowRunLogFindMany.mockResolvedValue([
      {
        stepId: "send-email",
        stepType: "send_email",
        input: { to: "email", subject: "Thanks for your response" },
        output: { provider: "smtp", messageId: "<deadbeef@example.com>" },
        startedAt: new Date("2026-06-09T12:01:00.000Z"),
        finishedAt: new Date("2026-06-09T12:01:01.000Z"),
      },
    ]);

    await expect(processWorkflowRunJob(data, baseContext)).resolves.toBeUndefined();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockWorkflowRunLogCreate).not.toHaveBeenCalled();
    const completion = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(completion.data.status).toBe("completed");
    expect(completion.data.data.steps[0]).toMatchObject({
      stepId: "send-email",
      status: "succeeded",
      output: { provider: "smtp", messageId: "<deadbeef@example.com>" },
    });
  });

  test("keeps the run non-terminal and rethrows on a non-final attempt when SMTP is not configured", async () => {
    mockSendEmail.mockResolvedValue(false);

    await expect(processWorkflowRunJob(data, baseContext)).rejects.toThrow(/SMTP is not configured/);

    const statuses = mockWorkflowRunUpdateMany.mock.calls.map((call) => call[0].data.status);
    expect(statuses).not.toContain("failed");
  });

  test("marks the run failed on the final attempt when SMTP is not configured (sendEmail returns false)", async () => {
    mockSendEmail.mockResolvedValue(false);

    await expect(processWorkflowRunJob(data, finalAttemptContext)).resolves.toBeUndefined();

    const failure = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(failure.data.status).toBe("failed");
    expect(failure.data.error).toMatch(/SMTP is not configured/);
    expect(failure.data.data.steps[0]).toMatchObject({ status: "failed" });
  });

  test("keeps the run non-terminal and rethrows on a non-final attempt when sendEmail throws", async () => {
    mockSendEmail.mockRejectedValue(new Error("SMTP provider rejected the message"));

    await expect(processWorkflowRunJob(data, baseContext)).rejects.toThrow(/SMTP provider rejected/);

    const statuses = mockWorkflowRunUpdateMany.mock.calls.map((call) => call[0].data.status);
    expect(statuses).not.toContain("failed");
  });

  test("marks the run failed on the final attempt when sendEmail throws", async () => {
    mockSendEmail.mockRejectedValue(new Error("SMTP provider rejected the message"));

    await expect(processWorkflowRunJob(data, finalAttemptContext)).resolves.toBeUndefined();

    const failure = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(failure.data.status).toBe("failed");
    expect(failure.data.data.steps[0]).toMatchObject({
      status: "failed",
      error: "SMTP provider rejected the message",
    });
  });

  test("marks the run failed for an invalid / non-executable definition (final attempt)", async () => {
    mockWorkflowRunFindFirst.mockResolvedValue({
      ...baseRun,
      workflowVersion: { definition: { not: "a workflow" } },
      workflow: { definition: { not: "a workflow" } },
    });

    await expect(processWorkflowRunJob(data, finalAttemptContext)).resolves.toBeUndefined();

    expect(mockSendEmail).not.toHaveBeenCalled();
    const failure = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(failure.data.status).toBe("failed");
  });

  test("sanitizes control characters out of the subject before sending", async () => {
    mockWorkflowRunFindFirst.mockResolvedValue({
      ...baseRun,
      workflowVersion: { definition: makeDefinition("email", { subject: "Hi\r\nBcc: evil@example.com" }) },
      workflow: { definition: makeDefinition("email", { subject: "Hi\r\nBcc: evil@example.com" }) },
    });

    await processWorkflowRunJob(data, baseContext);

    const sendArgs = mockSendEmail.mock.calls[0][0];
    expect(sendArgs.subject).toBe("HiBcc: evil@example.com");
    expect(sendArgs.subject).not.toContain("\r");
    expect(sendArgs.subject).not.toContain("\n");
  });

  test("swallows the failure on the final attempt after recording it", async () => {
    mockSendEmail.mockRejectedValue(new Error("SMTP provider rejected the message"));

    await expect(processWorkflowRunJob(data, finalAttemptContext)).resolves.toBeUndefined();

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
