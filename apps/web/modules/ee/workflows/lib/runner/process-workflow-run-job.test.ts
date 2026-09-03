import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
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
  mockWorkflowRunLogUpdate,
  mockWorkflowRunLogUpdateMany,
  mockWorkflowRunLogFindFirst,
  mockGetResponse,
  mockGetSurvey,
  mockGetOrganizationByWorkspaceId,
  mockGetWorkspaceMemberEmails,
  mockCapturePostHogEvent,
} = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
  mockBuildHtml: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockWorkflowRunFindFirst: vi.fn(),
  mockWorkflowRunUpdateMany: vi.fn(),
  mockWorkflowRunLogCreate: vi.fn(),
  mockWorkflowRunLogUpdate: vi.fn(),
  mockWorkflowRunLogUpdateMany: vi.fn(),
  mockWorkflowRunLogFindFirst: vi.fn(),
  mockGetResponse: vi.fn(),
  mockGetSurvey: vi.fn(),
  mockGetOrganizationByWorkspaceId: vi.fn(),
  mockGetWorkspaceMemberEmails: vi.fn(),
  mockCapturePostHogEvent: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    workflowRun: {
      findFirst: mockWorkflowRunFindFirst,
      updateMany: mockWorkflowRunUpdateMany,
    },
    workflowRunLog: {
      create: mockWorkflowRunLogCreate,
      update: mockWorkflowRunLogUpdate,
      updateMany: mockWorkflowRunLogUpdateMany,
      findFirst: mockWorkflowRunLogFindFirst,
    },
    // Better Auth 1.7's oauthProvider plugin seeds resources at boot (ENG-2343); this module's import
    // graph reaches auth.ts, and a boot-time seed against a model this mock doesn't declare throws an
    // unhandled BetterAuthError.
    oauthResource: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((args: { data: unknown }) => Promise.resolve(args.data)),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockImplementation((args: { data: unknown }) => Promise.resolve(args.data)),
      upsert: vi.fn().mockImplementation((args: { create: unknown }) => Promise.resolve(args.create)),
    },
  },
}));

// Prisma's known-request-error shape the claim path checks for a P2002 unique-constraint conflict.
vi.mock("@formbricks/database/prisma", () => ({
  // The workflow runner's merged import graph reaches the AuthZed projectors, which map these
  // Prisma enums to relation names at module scope. Values mirror the Prisma schema.
  ApiKeyPermission: { manage: "manage", read: "read", write: "write" },
  OrganizationRole: { billing: "billing", manager: "manager", member: "member", owner: "owner" },
  TeamUserRole: { admin: "admin", contributor: "contributor" },
  WorkspaceTeamPermission: { manage: "manage", read: "read", readWrite: "readWrite" },
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(message: string, { code }: { code: string }) {
        super(message);
        this.code = code;
      }
    },
  },
}));

vi.mock("@formbricks/database/types/error", () => ({
  PrismaErrorType: { UniqueConstraintViolation: "P2002" },
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

vi.mock("@/lib/workspace/service", () => ({
  getWorkspaceMemberEmails: mockGetWorkspaceMemberEmails,
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: mockCapturePostHogEvent,
}));

vi.mock("@formbricks/logger", () => {
  const mockLogger = {
    debug: vi.fn(),
    error: mockLoggerError,
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    // Better Auth 1.7 (ENG-2343) warns during init() — via our betterAuthLogger, which calls
    // logger.withContext(...) — for the oauthAuthServerConfig discovery warning silenceWarnings used
    // to suppress. Mirror the real logger's child-logger shape so that doesn't crash as unhandled.
    withContext: vi.fn(() => mockLogger),
  };
  return { logger: mockLogger };
});

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
  triggerType: "response.completed",
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

const mockSurvey = {
  id: "cm9zr4mps000008l8btfy1vtz",
  workspaceId: "cm9zr4wsp000508l8y6nh9r2v",
  blocks: [],
  languages: [],
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

// A single-attempt context — the real prod queue config (attempts: 1), where attempt 1 IS the final one.
const singleAttemptContext = { ...baseContext, attempt: 1, maxAttempts: 1 };

const makeP2002 = (): Error =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

// A persisted WorkflowRunLog row for `(runId, "send-email")` in a given state, as findFirst returns it.
const existingStepLog = (status: string, overrides: Record<string, unknown> = {}) => ({
  stepId: "send-email",
  stepType: "send_email",
  status,
  input: { to: "email", subject: "Thanks for your response" },
  output: status === "succeeded" ? { provider: "smtp", messageId: "<deadbeef@example.com>" } : {},
  error: null,
  startedAt: new Date("2026-06-09T12:01:00.000Z"),
  finishedAt: status === "succeeded" ? new Date("2026-06-09T12:01:01.000Z") : null,
  ...overrides,
});

describe("processWorkflowRunJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkflowRunFindFirst.mockResolvedValue(baseRun);
    mockWorkflowRunUpdateMany.mockResolvedValue({ count: 1 });
    // No prior step log by default → the step gets claimed via create({status:"running"}) then sent.
    mockWorkflowRunLogFindFirst.mockResolvedValue(null);
    mockWorkflowRunLogCreate.mockResolvedValue(undefined);
    mockWorkflowRunLogUpdate.mockResolvedValue(undefined);
    mockWorkflowRunLogUpdateMany.mockResolvedValue({ count: 1 });
    mockSendEmail.mockResolvedValue(true);
    mockBuildHtml.mockResolvedValue("<html>branded</html>");
    mockGetResponse.mockResolvedValue(mockResponse);
    mockGetSurvey.mockResolvedValue(mockSurvey);
    mockGetOrganizationByWorkspaceId.mockResolvedValue({ id: "org1", whitelabel: { logoUrl: "logo.png" } });
    // Recipient allowlist (ENG-2029): the literal addresses the send tests target are org members.
    mockGetWorkspaceMemberEmails.mockResolvedValue(new Set(["teammate@example.com", "jane@example.com"]));
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
      replyTo: "support@example.com",
      subject: "Thanks for your response",
      html: "<html>branded</html>",
    });
    // No `from` — the deployment MAIL_FROM default applies (Follow-Ups parity).
    expect(sendArgs.from).toBeUndefined();
    expect(sendArgs.text).toBeUndefined();
    expect(sendArgs.messageId).toMatch(/^<.+@example\.com>$/);

    // Claim-before-send: the step row is created `running` first, then updated to `succeeded` on the
    // same row (never a second create).
    expect(mockWorkflowRunLogCreate).toHaveBeenCalledTimes(1);
    expect(mockWorkflowRunLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ runId: baseRun.id, stepId: "send-email", status: "running" }),
      })
    );
    expect(mockWorkflowRunLogUpdate).toHaveBeenCalledTimes(1);
    expect(mockWorkflowRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { runId_stepId: { runId: baseRun.id, stepId: "send-email" } },
        data: expect.objectContaining({
          status: "succeeded",
          output: { provider: "smtp", messageId: sendArgs.messageId },
        }),
      })
    );

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

  test("does not send to a literal recipient outside the workspace allowlist (ENG-2029)", async () => {
    // A literal external recipient with no workspace access: the step fails and no email is sent,
    // even though the address resolves fine — the send-time backstop to the enable-time check.
    mockGetWorkspaceMemberEmails.mockResolvedValue(new Set(["teammate@example.com"]));
    mockWorkflowRunFindFirst.mockResolvedValue({
      ...baseRun,
      workflowVersion: { definition: makeDefinition("attacker@external-evil.example") },
      workflow: { definition: makeDefinition("attacker@external-evil.example") },
    });

    await processWorkflowRunJob(data, finalAttemptContext);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockWorkflowRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          error: expect.stringContaining("cannot access this workspace"),
        }),
      })
    );
  });

  test("stops sending to a member whose team lost access to this workspace (ENG-2186)", async () => {
    // The workflow was enabled while the recipient still had access; the allowlist is workspace-
    // scoped, so once their team is unlinked from the workspace the live run must stop delivering
    // this workspace's response data to them — even though they are still in the organization.
    mockGetWorkspaceMemberEmails.mockResolvedValue(new Set(["still-has-access@example.com"]));
    mockWorkflowRunFindFirst.mockResolvedValue({
      ...baseRun,
      workflowVersion: { definition: makeDefinition("revoked-member@example.com") },
      workflow: { definition: makeDefinition("revoked-member@example.com") },
    });

    await processWorkflowRunJob(data, finalAttemptContext);

    expect(mockGetWorkspaceMemberEmails).toHaveBeenCalledWith(data.workspaceId);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockWorkflowRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          error: expect.stringContaining("cannot access this workspace"),
        }),
      })
    );
  });

  test("matches a literal recipient against the allowlist case-insensitively (ENG-2029)", async () => {
    // The member allowlist is lowercased; a mixed-case literal `to` must still match and send.
    mockGetWorkspaceMemberEmails.mockResolvedValue(new Set(["teammate@example.com"]));
    mockWorkflowRunFindFirst.mockResolvedValue({
      ...baseRun,
      workflowVersion: { definition: makeDefinition("Teammate@Example.com") },
      workflow: { definition: makeDefinition("Teammate@Example.com") },
    });

    await processWorkflowRunJob(data, baseContext);

    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "Teammate@Example.com" }));
  });

  test("fails closed for a literal recipient when the workspace resolves to nobody (ENG-2029)", async () => {
    // Empty allowlist → a literal recipient is rejected rather than sent unchecked.
    mockGetWorkspaceMemberEmails.mockResolvedValue(new Set());
    mockWorkflowRunFindFirst.mockResolvedValue({
      ...baseRun,
      workflowVersion: { definition: makeDefinition("teammate@example.com") },
      workflow: { definition: makeDefinition("teammate@example.com") },
    });

    await processWorkflowRunJob(data, finalAttemptContext);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockWorkflowRunLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          error: expect.stringContaining("cannot access this workspace"),
        }),
      })
    );
  });

  test("still sends to a respondent-field recipient even when it is outside the member allowlist", async () => {
    // A field-resolved recipient is the respondent's own address, always allowed regardless of the
    // workspace allowlist — only literal addresses are gated.
    mockGetWorkspaceMemberEmails.mockResolvedValue(new Set());
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

  test("does not query the member allowlist when no step has a literal recipient", async () => {
    // The allowlist only gates literal addresses, so the common respondent-field run must not pay an
    // unbounded membership query on every completed response.
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

    expect(mockGetWorkspaceMemberEmails).not.toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "jane@example.com" }));
  });

  test("queries the member allowlist once when a step has a literal recipient", async () => {
    mockGetWorkspaceMemberEmails.mockResolvedValue(new Set(["teammate@example.com"]));
    mockWorkflowRunFindFirst.mockResolvedValue({
      ...baseRun,
      workflowVersion: { definition: makeDefinition("teammate@example.com") },
      workflow: { definition: makeDefinition("teammate@example.com") },
    });

    await processWorkflowRunJob(data, baseContext);

    expect(mockGetWorkspaceMemberEmails).toHaveBeenCalledTimes(1);
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

  test("claims a WorkflowRunLog row per executed step (running → succeeded, no duplicate create)", async () => {
    await processWorkflowRunJob(data, baseContext);

    // Exactly one row claimed (create running) and one terminal update — never two creates for a step.
    expect(mockWorkflowRunLogCreate).toHaveBeenCalledTimes(1);
    expect(mockWorkflowRunLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          runId: baseRun.id,
          sequence: 1,
          stepId: "send-email",
          stepType: "send_email",
          status: "running",
        }),
      })
    );
    expect(mockWorkflowRunLogUpdate).toHaveBeenCalledTimes(1);
    expect(mockWorkflowRunLogUpdate.mock.calls[0][0].data.status).toBe("succeeded");
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

  test("fails the run when the survey belongs to another workspace (final attempt → failed)", async () => {
    mockGetSurvey.mockResolvedValue({ ...mockSurvey, workspaceId: "cm9zr4wsp000000000foreign" });

    await expect(processWorkflowRunJob(data, finalAttemptContext)).resolves.toBeUndefined();

    expect(mockSendEmail).not.toHaveBeenCalled();
    const failure = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(failure.data.status).toBe("failed");
    expect(failure.data.error).toMatch(/does not belong to workspace/);
  });

  test("fails the run when the response belongs to another survey (final attempt → failed)", async () => {
    mockGetResponse.mockResolvedValue({ ...mockResponse, surveyId: "cm9zr4mps00000000foreign" });

    await expect(processWorkflowRunJob(data, finalAttemptContext)).resolves.toBeUndefined();

    expect(mockSendEmail).not.toHaveBeenCalled();
    const failure = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(failure.data.status).toBe("failed");
    expect(failure.data.error).toMatch(/does not belong to survey/);
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

  test("resume: does NOT re-send a step that already has a succeeded log", async () => {
    // Retry of a run mid-flight: run already `running`, its only step already `succeeded`.
    mockWorkflowRunFindFirst.mockResolvedValue({ ...baseRun, status: "running" });
    mockWorkflowRunUpdateMany.mockResolvedValue({ count: 0 });
    mockWorkflowRunLogFindFirst.mockResolvedValue(existingStepLog("succeeded"));

    await expect(processWorkflowRunJob(data, baseContext)).resolves.toBeUndefined();

    expect(mockSendEmail).not.toHaveBeenCalled();
    // No claim create and no re-update for an already-succeeded step.
    expect(mockWorkflowRunLogCreate).not.toHaveBeenCalled();
    expect(mockWorkflowRunLogUpdate).not.toHaveBeenCalled();
    const completion = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(completion.data.status).toBe("completed");
    expect(completion.data.data.steps[0]).toMatchObject({
      stepId: "send-email",
      status: "succeeded",
      output: { provider: "smtp", messageId: "<deadbeef@example.com>" },
    });
  });

  test("retry of a failed send: claims the failed row and re-sends (it never went out)", async () => {
    mockWorkflowRunFindFirst.mockResolvedValue({ ...baseRun, status: "running" });
    mockWorkflowRunUpdateMany.mockResolvedValue({ count: 0 });
    mockWorkflowRunLogFindFirst.mockResolvedValue(existingStepLog("failed", { error: "prev SMTP error" }));
    mockWorkflowRunLogUpdateMany.mockResolvedValue({ count: 1 });

    await expect(processWorkflowRunJob(data, baseContext)).resolves.toBeUndefined();

    // Claimed the failed row via updateMany (failed→running), then re-sent, then updated to succeeded.
    expect(mockWorkflowRunLogUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { runId: baseRun.id, stepId: "send-email", status: { in: ["failed", "pending"] } },
        data: expect.objectContaining({ status: "running" }),
      })
    );
    expect(mockWorkflowRunLogCreate).not.toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const completion = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(completion.data.status).toBe("completed");
    expect(completion.data.data.steps[0]).toMatchObject({ status: "succeeded" });
  });

  test("crash-mid-send / concurrent: a running row → bail (no send, run left running, NOT finalized)", async () => {
    mockWorkflowRunFindFirst.mockResolvedValue({ ...baseRun, status: "running" });
    mockWorkflowRunUpdateMany.mockResolvedValue({ count: 0 });
    mockWorkflowRunLogFindFirst.mockResolvedValue(existingStepLog("running"));

    await expect(processWorkflowRunJob(data, baseContext)).resolves.toBeUndefined();

    // At-most-once: never re-send a step already claimed (running). And bail: never finalize a run the
    // owner still holds — no completed/failed write, so it's left `running` for the owner to finish.
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockWorkflowRunLogCreate).not.toHaveBeenCalled();
    expect(mockWorkflowRunLogUpdate).not.toHaveBeenCalled();
    expect(mockWorkflowRunLogUpdateMany).not.toHaveBeenCalled();
    const runStatuses = mockWorkflowRunUpdateMany.mock.calls.map((call) => call[0].data.status);
    expect(runStatuses).not.toContain("completed");
    expect(runStatuses).not.toContain("failed");
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ stepId: "send-email" }),
      "Workflow step already in-flight (running); another delivery owns this run — bailing"
    );
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.any(Object),
      "Workflow run owned by another delivery; leaving it running without finalizing"
    );
  });

  test("concurrent claim lost (create P2002): bail, no send, run not finalized", async () => {
    // No row on first read → attempt create → a concurrent worker created it first (P2002) → bail.
    mockWorkflowRunFindFirst.mockResolvedValue({ ...baseRun, status: "running" });
    mockWorkflowRunUpdateMany.mockResolvedValue({ count: 0 });
    mockWorkflowRunLogFindFirst.mockResolvedValue(null);
    mockWorkflowRunLogCreate.mockRejectedValueOnce(makeP2002());

    await expect(processWorkflowRunJob(data, baseContext)).resolves.toBeUndefined();

    expect(mockSendEmail).not.toHaveBeenCalled();
    const runStatuses = mockWorkflowRunUpdateMany.mock.calls.map((call) => call[0].data.status);
    expect(runStatuses).not.toContain("completed");
    expect(runStatuses).not.toContain("failed");
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ stepId: "send-email" }),
      "Workflow step claim lost to a concurrent delivery — bailing"
    );
  });

  test("concurrent claim lost (failed row, updateMany count 0): bail, no send, run not finalized", async () => {
    mockWorkflowRunFindFirst.mockResolvedValue({ ...baseRun, status: "running" });
    mockWorkflowRunUpdateMany.mockResolvedValue({ count: 0 });
    mockWorkflowRunLogFindFirst.mockResolvedValue(existingStepLog("failed"));
    mockWorkflowRunLogUpdateMany.mockResolvedValue({ count: 0 });

    await expect(processWorkflowRunJob(data, baseContext)).resolves.toBeUndefined();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockWorkflowRunLogCreate).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ stepId: "send-email" }),
      "Workflow step claim lost to a concurrent delivery — bailing"
    );
    const runStatuses = mockWorkflowRunUpdateMany.mock.calls.map((call) => call[0].data.status);
    expect(runStatuses).not.toContain("completed");
    expect(runStatuses).not.toContain("failed");
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

  test("reports one workflow_run_failed with the failed step on the final attempt (ENG-2851)", async () => {
    mockSendEmail.mockRejectedValue(new Error("SMTP provider rejected the message for jane@example.com"));
    mockGetOrganizationByWorkspaceId.mockResolvedValue({ id: "org_1" });

    await expect(processWorkflowRunJob(data, finalAttemptContext)).resolves.toBeUndefined();

    expect(mockCapturePostHogEvent).toHaveBeenCalledTimes(1);
    const [distinctId, event, properties, groups] = mockCapturePostHogEvent.mock.calls[0];
    expect(distinctId).toBe("org_1");
    expect(event).toBe("workflow_run_failed");
    expect(properties).toEqual({
      workflow_id: data.workflowId,
      workspace_id: data.workspaceId,
      organization_id: "org_1",
      run_id: baseRun.id,
      trigger_type: "response.completed",
      failed_step_type: "send_email",
      error_kind: "step_failed",
      attempt: finalAttemptContext.attempt,
    });
    // The message can name a recipient, so it never travels; only the coarse kind does.
    expect(JSON.stringify(properties)).not.toContain("jane@example.com");
    expect(groups).toEqual({ organizationId: "org_1", workspaceId: data.workspaceId });
  });

  test("does not report a failure on a non-final attempt (retries must not inflate the rate)", async () => {
    mockSendEmail.mockRejectedValue(new Error("SMTP provider rejected the message"));

    await expect(processWorkflowRunJob(data, baseContext)).rejects.toThrow();

    expect(mockCapturePostHogEvent).not.toHaveBeenCalled();
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

  test("maxAttempts:1 — pool exhaustion on the only attempt records failed (never stuck running)", async () => {
    // The real prod config: attempts:1, so the first attempt is also the final one. A pool-exhaustion
    // here must be recorded terminal `failed`, not rethrown into the void leaving the run `running`.
    mockWorkflowRunUpdateMany.mockImplementation(({ data: updateData }: { data: { status?: string } }) => {
      if (updateData.status === "running") {
        return Promise.reject(new Error("Timed out fetching a new connection from the connection pool"));
      }
      return Promise.resolve({ count: 1 });
    });

    // Swallowed on the final attempt (no rethrow into BullMQ with nothing left to retry).
    await expect(processWorkflowRunJob(data, singleAttemptContext)).resolves.toBeUndefined();

    const failure = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
    expect(failure.data.status).toBe("failed");
    expect(failure.data.finishedAt).toBeInstanceOf(Date);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      "Workflow run job failed after final attempt"
    );
  });
});
