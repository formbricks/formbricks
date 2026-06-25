import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TResponsePipelineJobData } from "@formbricks/jobs";
import { FollowUpSendError } from "@/modules/survey/follow-ups/types/follow-up";
import { processResponsePipelineJob } from "./process-response-pipeline-job";

const {
  mockFetch,
  mockCaptureSurveyResponsePostHogEvent,
  mockCreatePinnedDispatcher,
  mockDispatcherDestroy,
  mockEnqueueResponseCompletedWorkflowRuns,
  mockGetIntegrations,
  mockGetResponseCountBySurveyId,
  mockHandleIntegrations,
  mockLoggerError,
  mockLoggerWarn,
  mockPrismaOrganizationFindFirst,
  mockPrismaSurveyFindUnique,
  mockPrismaSurveyUpdate,
  mockPrismaUserFindMany,
  mockPrismaWebhookFindMany,
  mockQueueAuditEventWithoutRequest,
  mockRecordResponseCreatedMeterEvent,
  mockSendFollowUpsForResponse,
  mockSendResponseFinishedEmail,
  mockSendTelemetryEvents,
  mockValidateAndResolveWebhookUrl,
} = vi.hoisted(() => {
  process.env.HUB_API_URL ??= "https://hub.test";
  const dispatcherDestroy = vi.fn().mockResolvedValue(undefined);

  return {
    mockFetch: vi.fn(),
    mockCaptureSurveyResponsePostHogEvent: vi.fn(),
    mockCreatePinnedDispatcher: vi.fn(() => ({ destroy: dispatcherDestroy })),
    mockDispatcherDestroy: dispatcherDestroy,
    mockEnqueueResponseCompletedWorkflowRuns: vi.fn(),
    mockGetIntegrations: vi.fn(),
    mockGetResponseCountBySurveyId: vi.fn(),
    mockHandleIntegrations: vi.fn(),
    mockLoggerError: vi.fn(),
    mockLoggerWarn: vi.fn(),
    mockPrismaOrganizationFindFirst: vi.fn(),
    mockPrismaSurveyFindUnique: vi.fn(),
    mockPrismaSurveyUpdate: vi.fn(),
    mockPrismaUserFindMany: vi.fn(),
    mockPrismaWebhookFindMany: vi.fn(),
    mockQueueAuditEventWithoutRequest: vi.fn(),
    mockRecordResponseCreatedMeterEvent: vi.fn(),
    mockSendFollowUpsForResponse: vi.fn(),
    mockSendResponseFinishedEmail: vi.fn(),
    mockSendTelemetryEvents: vi.fn(),
    mockValidateAndResolveWebhookUrl: vi.fn(),
  };
});

vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findFirst: mockPrismaOrganizationFindFirst,
    },
    survey: {
      findUnique: mockPrismaSurveyFindUnique,
      update: mockPrismaSurveyUpdate,
    },
    webhook: {
      findMany: mockPrismaWebhookFindMany,
    },
    user: {
      findMany: mockPrismaUserFindMany,
    },
  },
}));

vi.mock("@formbricks/jobs", () => ({
  UnrecoverableError: class UnrecoverableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "UnrecoverableError";
    }
  },
}));

vi.mock(import("@/lib/constants"), async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    POSTHOG_KEY: undefined,
    DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS: false,
  };
});

vi.mock("./handle-integrations", () => ({
  handleIntegrations: mockHandleIntegrations,
}));

vi.mock("./telemetry", () => ({
  sendTelemetryEvents: mockSendTelemetryEvents,
}));

vi.mock("@/lib/integration/service", () => ({
  getIntegrations: mockGetIntegrations,
}));

vi.mock("@/lib/response/service", () => ({
  getResponseCountBySurveyId: mockGetResponseCountBySurveyId,
}));

vi.mock("./posthog", () => ({
  captureSurveyResponsePostHogEvent: mockCaptureSurveyResponsePostHogEvent,
}));

vi.mock("@/lib/utils/validate-webhook-url", () => ({
  validateAndResolveWebhookUrl: mockValidateAndResolveWebhookUrl,
  createPinnedDispatcher: mockCreatePinnedDispatcher,
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventWithoutRequest: mockQueueAuditEventWithoutRequest,
}));

vi.mock("@/modules/ee/billing/lib/metering", () => ({
  recordResponseCreatedMeterEvent: mockRecordResponseCreatedMeterEvent,
}));

vi.mock("@/modules/email", () => ({
  sendResponseFinishedEmail: mockSendResponseFinishedEmail,
}));

vi.mock("@/modules/survey/follow-ups/lib/follow-ups", () => ({
  sendFollowUpsForResponse: mockSendFollowUpsForResponse,
}));

vi.mock("@/modules/workflows/lib/runner/enqueue-response-completed-runs", () => ({
  enqueueResponseCompletedWorkflowRuns: mockEnqueueResponseCompletedWorkflowRuns,
}));

vi.mock("@/modules/workflows/lib/runner/dispatch", () => ({
  dispatchWorkflowRunViaJobs: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: mockLoggerError,
    info: vi.fn(),
    warn: mockLoggerWarn,
  },
}));

const baseData: TResponsePipelineJobData = {
  workspaceId: "workspace_123",
  event: "responseCreated",
  response: {
    contact: null,
    contactAttributes: null,
    createdAt: new Date("2026-04-08T10:00:00.000Z"),
    data: { answer: "yes" },
    displayId: null,
    endingId: null,
    finished: true,
    id: "response_123",
    language: null,
    meta: {},
    singleUseId: null,
    surveyId: "survey_123",
    tags: [],
    updatedAt: new Date("2026-04-08T10:00:00.000Z"),
    variables: {},
  },
  surveyId: "survey_123",
};

const baseContext = {
  attempt: 1,
  jobId: "job_123",
  jobName: "response-pipeline.process",
  maxAttempts: 3,
  queueName: "background-jobs",
};

const finalAttemptContext = {
  ...baseContext,
  attempt: baseContext.maxAttempts,
};

const organization = {
  billing: {
    stripeCustomerId: "cus_123",
  },
  id: "org_123",
};

const survey = {
  blocks: [],
  autoComplete: null,
  createdAt: new Date("2026-04-01T10:00:00.000Z"),
  followUps: [],
  hiddenFields: {
    fieldIds: [],
  },
  id: "survey_123",
  languages: [],
  name: "Test survey",
  status: "inProgress",
  type: "app",
  updatedAt: new Date("2026-04-01T10:00:00.000Z"),
  variables: [],
  workspaceId: "workspace_123",
};

const originalFetch = global.fetch;

describe("processResponsePipelineJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaOrganizationFindFirst.mockResolvedValue(organization);
    mockPrismaSurveyFindUnique.mockResolvedValue(survey);
    mockGetIntegrations.mockResolvedValue([]);
    mockPrismaWebhookFindMany.mockResolvedValue([]);
    mockPrismaUserFindMany.mockResolvedValue([]);
    mockGetResponseCountBySurveyId.mockResolvedValue(1);
    mockHandleIntegrations.mockResolvedValue(undefined);
    mockValidateAndResolveWebhookUrl.mockResolvedValue({ ip: "93.184.216.34", family: 4 });
    mockDispatcherDestroy.mockResolvedValue(undefined);
    mockCreatePinnedDispatcher.mockImplementation(() => ({ destroy: mockDispatcherDestroy }));
    mockQueueAuditEventWithoutRequest.mockResolvedValue(undefined);
    mockRecordResponseCreatedMeterEvent.mockResolvedValue(undefined);
    mockSendResponseFinishedEmail.mockResolvedValue(undefined);
    mockSendFollowUpsForResponse.mockResolvedValue({ ok: true, data: [] });
    mockEnqueueResponseCompletedWorkflowRuns.mockResolvedValue(undefined);
    mockSendTelemetryEvents.mockResolvedValue(undefined);
    mockPrismaSurveyUpdate.mockResolvedValue(undefined);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });
    global.fetch = mockFetch as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mockFetch.mockReset();
  });

  test("invokes the workflow runner on responseFinished", async () => {
    await expect(
      processResponsePipelineJob({ ...baseData, event: "responseFinished" }, baseContext)
    ).resolves.toBeUndefined();

    expect(mockEnqueueResponseCompletedWorkflowRuns).toHaveBeenCalledTimes(1);
    expect(mockEnqueueResponseCompletedWorkflowRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        response: expect.objectContaining({ id: "response_123" }),
        workspaceId: "workspace_123",
      })
    );
  });

  test("does not invoke the workflow runner on responseCreated", async () => {
    await expect(processResponsePipelineJob(baseData, baseContext)).resolves.toBeUndefined();
    expect(mockEnqueueResponseCompletedWorkflowRuns).not.toHaveBeenCalled();
  });

  test("isolates a workflow runner failure from the response pipeline", async () => {
    mockEnqueueResponseCompletedWorkflowRuns.mockRejectedValue(new Error("runner boom"));

    await expect(
      processResponsePipelineJob({ ...baseData, event: "responseFinished" }, baseContext)
    ).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      "Response pipeline workflow run enqueue failed"
    );
  });

  test("processes responseCreated jobs with webhook, metering, and telemetry side effects", async () => {
    mockPrismaWebhookFindMany.mockResolvedValue([
      {
        id: "webhook_123",
        secret: "secret",
        url: "https://example.com/webhook",
      },
    ]);

    await expect(processResponsePipelineJob(baseData, baseContext)).resolves.toBeUndefined();

    expect(mockPrismaWebhookFindMany).toHaveBeenCalledWith({
      where: {
        OR: [{ surveyIds: { has: "survey_123" } }, { surveyIds: { isEmpty: true } }],
        workspaceId: "workspace_123",
        triggers: { has: "responseCreated" },
      },
    });
    expect(mockValidateAndResolveWebhookUrl).toHaveBeenCalledWith("https://example.com/webhook");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        body: expect.stringContaining('"event":"responseCreated"'),
        headers: expect.objectContaining({
          "content-type": "application/json",
          "webhook-id": expect.any(String),
          "webhook-signature": expect.any(String),
          "webhook-timestamp": expect.any(String),
        }),
        method: "POST",
      })
    );
    expect(mockRecordResponseCreatedMeterEvent).toHaveBeenCalledWith({
      createdAt: baseData.response.createdAt,
      responseId: "response_123",
      stripeCustomerId: "cus_123",
    });
    expect(mockSendTelemetryEvents).toHaveBeenCalledTimes(1);
    expect(mockHandleIntegrations).not.toHaveBeenCalled();
  });

  test("uses a stable webhook id for the same BullMQ job across retry attempts", async () => {
    mockPrismaWebhookFindMany.mockResolvedValue([
      {
        id: "webhook_123",
        secret: null,
        url: "https://example.com/webhook",
      },
    ]);

    await expect(processResponsePipelineJob(baseData, baseContext)).resolves.toBeUndefined();
    await expect(processResponsePipelineJob(baseData, finalAttemptContext)).resolves.toBeUndefined();

    const firstHeaders = mockFetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
    const secondHeaders = mockFetch.mock.calls[1]?.[1]?.headers as Record<string, string>;

    expect(firstHeaders["webhook-id"]).toBe(secondHeaders["webhook-id"]);
  });

  test("processes responseFinished jobs and preserves legacy side effects", async () => {
    mockGetIntegrations.mockResolvedValue([{ id: "integration_123", type: "slack" }]);
    mockPrismaSurveyFindUnique.mockResolvedValue({
      ...survey,
      autoComplete: 1,
      followUps: [{ id: "followup_123" }],
    });
    mockPrismaWebhookFindMany.mockResolvedValue([
      {
        id: "webhook_123",
        secret: null,
        url: "https://example.com/webhook",
      },
    ]);
    mockPrismaUserFindMany.mockResolvedValue([
      {
        email: "owner@example.com",
        locale: "en",
      },
    ]);

    await expect(
      processResponsePipelineJob(
        {
          ...baseData,
          event: "responseFinished",
          locale: "de-DE",
        },
        baseContext
      )
    ).resolves.toBeUndefined();

    expect(mockHandleIntegrations).toHaveBeenCalledWith(
      [{ id: "integration_123", type: "slack" }],
      expect.objectContaining({ event: "responseFinished" }),
      {
        ...survey,
        autoComplete: 1,
        followUps: [{ id: "followup_123" }],
      }
    );
    expect(mockPrismaUserFindMany).toHaveBeenCalledWith({
      select: { email: true, locale: true },
      where: {
        memberships: {
          some: {
            organization: {
              workspaces: {
                some: {
                  id: "workspace_123",
                },
              },
            },
          },
        },
        notificationSettings: {
          equals: true,
          path: ["alert", "survey_123"],
        },
        OR: [
          {
            memberships: {
              some: {
                role: {
                  in: ["owner", "manager"],
                },
                organization: {
                  workspaces: {
                    some: {
                      id: "workspace_123",
                    },
                  },
                },
              },
            },
          },
          {
            teamUsers: {
              some: {
                team: {
                  workspaceTeams: {
                    some: {
                      workspace: {
                        id: "workspace_123",
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    });
    expect(mockSendFollowUpsForResponse).toHaveBeenCalledWith("response_123", "de-DE");
    expect(mockSendResponseFinishedEmail).toHaveBeenCalledWith(
      "owner@example.com",
      "en-US",
      "workspace_123",
      expect.objectContaining({ id: "survey_123" }),
      baseData.response,
      1
    );
    expect(mockPrismaSurveyUpdate).toHaveBeenCalledWith({
      data: {
        status: "completed",
      },
      where: {
        id: "survey_123",
      },
    });
    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        organizationId: "org_123",
        status: "success",
        targetId: "survey_123",
        targetType: "survey",
        userType: "system",
      })
    );
    expect(mockSendTelemetryEvents).not.toHaveBeenCalled();
  });

  test("logs responseFinished side-effect failures without failing the job", async () => {
    mockPrismaUserFindMany.mockResolvedValue([
      {
        email: "owner@example.com",
        locale: "en",
      },
    ]);
    mockSendResponseFinishedEmail.mockRejectedValue(new Error("smtp failed"));
    mockSendFollowUpsForResponse.mockResolvedValue({
      ok: false,
      error: {
        code: FollowUpSendError.FOLLOW_UP_NOT_ALLOWED,
        message: "not allowed",
      },
    });
    mockPrismaSurveyUpdate.mockRejectedValue(new Error("update failed"));
    mockPrismaSurveyFindUnique.mockResolvedValue({
      ...survey,
      autoComplete: 1,
      followUps: [{ id: "followup_123" }],
    });

    await expect(
      processResponsePipelineJob(
        {
          ...baseData,
          event: "responseFinished",
        },
        baseContext
      )
    ).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        userEmail: "owner@example.com",
      }),
      "Response pipeline notification email failed"
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
      }),
      "Response pipeline survey auto-complete update failed"
    );
    const auditCall = mockQueueAuditEventWithoutRequest.mock.calls.at(-1)?.[0];
    expect(auditCall).toEqual(
      expect.objectContaining({
        status: "failure",
      })
    );
    expect(auditCall).not.toHaveProperty("newObject");
  });

  test("fails the job before the final attempt when webhook delivery fails", async () => {
    const webhookError = new Error("invalid webhook");
    mockGetIntegrations.mockResolvedValue([{ id: "integration_123", type: "slack" }]);
    mockPrismaSurveyFindUnique.mockResolvedValue({
      ...survey,
      autoComplete: 1,
      followUps: [{ id: "followup_123" }],
    });
    mockPrismaUserFindMany.mockResolvedValue([
      {
        email: "owner@example.com",
        locale: "en",
      },
    ]);
    mockPrismaWebhookFindMany.mockResolvedValue([
      {
        id: "webhook_123",
        secret: null,
        url: "https://example.com/webhook",
      },
    ]);
    mockValidateAndResolveWebhookUrl.mockRejectedValue(webhookError);

    await expect(
      processResponsePipelineJob(
        {
          ...baseData,
          event: "responseFinished",
        },
        baseContext
      )
    ).rejects.toThrow("invalid webhook");

    expect(mockHandleIntegrations).not.toHaveBeenCalled();
    expect(mockSendFollowUpsForResponse).not.toHaveBeenCalled();
    expect(mockSendResponseFinishedEmail).not.toHaveBeenCalled();
    expect(mockPrismaSurveyUpdate).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: webhookError,
        webhookId: "webhook_123",
      }),
      "Response pipeline webhook delivery failed"
    );
  });

  test("continues responseFinished side effects on the final webhook attempt", async () => {
    const webhookError = new Error("invalid webhook");
    mockGetIntegrations.mockResolvedValue([{ id: "integration_123", type: "slack" }]);
    mockPrismaSurveyFindUnique.mockResolvedValue({
      ...survey,
      autoComplete: 1,
      followUps: [{ id: "followup_123" }],
    });
    mockPrismaWebhookFindMany.mockResolvedValue([
      {
        id: "webhook_123",
        secret: null,
        url: "https://example.com/webhook",
      },
    ]);
    mockPrismaUserFindMany.mockResolvedValue([
      {
        email: "owner@example.com",
        locale: "en",
      },
    ]);
    mockValidateAndResolveWebhookUrl.mockRejectedValue(webhookError);

    await expect(
      processResponsePipelineJob(
        {
          ...baseData,
          event: "responseFinished",
        },
        finalAttemptContext
      )
    ).resolves.toBeUndefined();

    expect(mockHandleIntegrations).toHaveBeenCalledTimes(1);
    expect(mockSendFollowUpsForResponse).toHaveBeenCalledWith("response_123", undefined);
    expect(mockSendResponseFinishedEmail).toHaveBeenCalledTimes(1);
    expect(mockPrismaSurveyUpdate).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 3,
        failedWebhookCount: 1,
        maxAttempts: 3,
      }),
      "Response pipeline webhook delivery exhausted retries; continuing with remaining side effects"
    );
  });

  test("logs integration failures without failing the responseFinished job", async () => {
    const integrationError = new Error("slack offline");
    mockGetIntegrations.mockResolvedValue([{ id: "integration_123", type: "slack" }]);
    mockHandleIntegrations.mockRejectedValue(integrationError);

    await expect(
      processResponsePipelineJob(
        {
          ...baseData,
          event: "responseFinished",
        },
        baseContext
      )
    ).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: integrationError,
        event: "responseFinished",
        jobId: "job_123",
      }),
      "Response pipeline integration handling failed"
    );
  });

  test("does not retry a successful webhook when later responseFinished side effects fail", async () => {
    const auditError = new Error("audit offline");
    mockPrismaSurveyFindUnique.mockResolvedValue({
      ...survey,
      autoComplete: 1,
    });
    mockPrismaWebhookFindMany.mockResolvedValue([
      {
        id: "webhook_123",
        secret: null,
        url: "https://example.com/webhook",
      },
    ]);
    mockQueueAuditEventWithoutRequest.mockRejectedValue(auditError);

    await expect(
      processResponsePipelineJob(
        {
          ...baseData,
          event: "responseFinished",
        },
        baseContext
      )
    ).resolves.toBeUndefined();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: auditError,
        event: "responseFinished",
        jobId: "job_123",
      }),
      "Response pipeline survey auto-complete audit log failed"
    );
  });

  test("logs response count lookup failures without retrying successful webhooks", async () => {
    const responseCountError = new Error("count offline");
    mockPrismaWebhookFindMany.mockResolvedValue([
      {
        id: "webhook_123",
        secret: null,
        url: "https://example.com/webhook",
      },
    ]);
    mockGetResponseCountBySurveyId.mockRejectedValue(responseCountError);

    await expect(
      processResponsePipelineJob(
        {
          ...baseData,
          event: "responseFinished",
        },
        baseContext
      )
    ).resolves.toBeUndefined();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: responseCountError,
        event: "responseFinished",
        jobId: "job_123",
      }),
      "Response pipeline response count lookup failed"
    );
  });

  test("logs telemetry failures without failing the responseCreated job", async () => {
    const telemetryError = new Error("telemetry offline");
    mockSendTelemetryEvents.mockRejectedValue(telemetryError);

    await expect(processResponsePipelineJob(baseData, baseContext)).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: telemetryError,
        event: "responseCreated",
        jobId: "job_123",
      }),
      "Response pipeline telemetry dispatch failed"
    );
  });

  test("fails the job when a webhook response is not successful", async () => {
    mockPrismaWebhookFindMany.mockResolvedValue([
      {
        id: "webhook_123",
        secret: null,
        url: "https://example.com/webhook",
      },
    ]);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(processResponsePipelineJob(baseData, baseContext)).rejects.toThrow(
      "Webhook delivery failed with status 500"
    );

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        webhookId: "webhook_123",
      }),
      "Response pipeline webhook delivery failed"
    );
  });

  test("continues responseCreated side effects on the final webhook attempt", async () => {
    mockPrismaWebhookFindMany.mockResolvedValue([
      {
        id: "webhook_123",
        secret: null,
        url: "https://example.com/webhook",
      },
    ]);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(processResponsePipelineJob(baseData, finalAttemptContext)).resolves.toBeUndefined();

    expect(mockRecordResponseCreatedMeterEvent).toHaveBeenCalledWith({
      createdAt: baseData.response.createdAt,
      responseId: "response_123",
      stripeCustomerId: "cus_123",
    });
    expect(mockSendTelemetryEvents).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 3,
        failedWebhookCount: 1,
        maxAttempts: 3,
      }),
      "Response pipeline webhook delivery exhausted retries; continuing with remaining side effects"
    );
  });

  test("awaits the metering write before finishing responseCreated jobs", async () => {
    let resolveMetering: (() => void) | undefined;
    const meteringPromise = new Promise<void>((resolve) => {
      resolveMetering = resolve;
    });
    mockRecordResponseCreatedMeterEvent.mockReturnValue(meteringPromise);

    let settled = false;
    const jobPromise = processResponsePipelineJob(baseData, baseContext).then(() => {
      settled = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(settled).toBe(false);
    expect(mockSendTelemetryEvents).not.toHaveBeenCalled();

    resolveMetering?.();
    await jobPromise;

    expect(mockSendTelemetryEvents).toHaveBeenCalledTimes(1);
  });

  test("fails fast when the workspace organization cannot be found", async () => {
    mockPrismaOrganizationFindFirst.mockResolvedValue(null);

    await expect(processResponsePipelineJob(baseData, baseContext)).rejects.toThrow(
      "Organization not found for workspace workspace_123"
    );

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace_123",
        err: expect.any(Error),
        jobId: "job_123",
        responseId: "response_123",
        surveyId: "survey_123",
      }),
      "Response pipeline job failed"
    );
  });

  test("fails fast when the survey cannot be found", async () => {
    mockPrismaSurveyFindUnique.mockResolvedValue(null);

    await expect(processResponsePipelineJob(baseData, baseContext)).rejects.toThrow(
      "Survey survey_123 not found"
    );

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace_123",
        err: expect.any(Error),
        jobId: "job_123",
        responseId: "response_123",
        surveyId: "survey_123",
      }),
      "Response pipeline job failed"
    );
  });

  test("pins fetch to the resolved webhook IP via undici dispatcher", async () => {
    mockPrismaWebhookFindMany.mockResolvedValue([
      {
        id: "webhook_123",
        secret: null,
        url: "https://example.com/webhook",
      },
    ]);
    const pinnedDispatcher = { destroy: mockDispatcherDestroy };
    mockValidateAndResolveWebhookUrl.mockResolvedValue({ ip: "203.0.113.10", family: 4 });
    mockCreatePinnedDispatcher.mockReturnValue(pinnedDispatcher);

    await expect(processResponsePipelineJob(baseData, baseContext)).resolves.toBeUndefined();

    expect(mockValidateAndResolveWebhookUrl).toHaveBeenCalledWith("https://example.com/webhook");
    expect(mockCreatePinnedDispatcher).toHaveBeenCalledWith({ ip: "203.0.113.10", family: 4 });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        dispatcher: pinnedDispatcher,
        redirect: "manual",
      })
    );
  });

  test("blocks 3xx redirects from webhook endpoints as delivery failures", async () => {
    mockPrismaWebhookFindMany.mockResolvedValue([
      {
        id: "webhook_123",
        secret: null,
        url: "https://example.com/webhook",
      },
    ]);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 302,
    });

    await expect(processResponsePipelineJob(baseData, baseContext)).rejects.toThrow(
      "Webhook delivery blocked: redirect status 302"
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({ redirect: "manual" })
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        webhookId: "webhook_123",
      }),
      "Response pipeline webhook delivery failed"
    );
  });

  test("destroys the pinned dispatcher after a successful webhook delivery", async () => {
    mockPrismaWebhookFindMany.mockResolvedValue([
      {
        id: "webhook_123",
        secret: null,
        url: "https://example.com/webhook",
      },
    ]);

    await expect(processResponsePipelineJob(baseData, baseContext)).resolves.toBeUndefined();

    expect(mockDispatcherDestroy).toHaveBeenCalledTimes(1);
  });

  test("logs dispatcher cleanup failures without failing a successful webhook delivery", async () => {
    const cleanupError = new Error("destroy failed");
    mockPrismaWebhookFindMany.mockResolvedValue([
      {
        id: "webhook_123",
        secret: null,
        url: "https://example.com/webhook",
      },
    ]);
    mockDispatcherDestroy.mockRejectedValue(cleanupError);

    await expect(processResponsePipelineJob(baseData, baseContext)).resolves.toBeUndefined();

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        err: cleanupError,
        webhookId: "webhook_123",
        webhookUrl: "https://example.com/webhook",
      }),
      "Response pipeline webhook dispatcher cleanup failed"
    );
  });

  test("destroys the pinned dispatcher when the webhook fetch throws", async () => {
    mockPrismaWebhookFindMany.mockResolvedValue([
      {
        id: "webhook_123",
        secret: null,
        url: "https://example.com/webhook",
      },
    ]);
    mockFetch.mockRejectedValue(new Error("connect refused"));

    await expect(processResponsePipelineJob(baseData, baseContext)).rejects.toThrow("connect refused");

    expect(mockDispatcherDestroy).toHaveBeenCalledTimes(1);
  });

  test("does not pin a dispatcher when the resolver returns null (internal URL flag)", async () => {
    mockPrismaWebhookFindMany.mockResolvedValue([
      {
        id: "webhook_123",
        secret: null,
        url: "http://localhost:3000/webhook",
      },
    ]);
    mockValidateAndResolveWebhookUrl.mockResolvedValue(null);

    await expect(processResponsePipelineJob(baseData, baseContext)).resolves.toBeUndefined();

    expect(mockCreatePinnedDispatcher).not.toHaveBeenCalled();
    expect(mockDispatcherDestroy).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/webhook",
      expect.objectContaining({ dispatcher: undefined })
    );
  });

  test("classifies database pool exhaustion as retryable and logs a warning", async () => {
    const poolExhaustionError = new Error("Timed out fetching a new connection from the connection pool");
    mockPrismaSurveyFindUnique.mockRejectedValue(poolExhaustionError);

    await expect(processResponsePipelineJob(baseData, baseContext)).rejects.toThrow(poolExhaustionError);

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace_123",
        err: poolExhaustionError,
        jobId: "job_123",
        responseId: "response_123",
        surveyId: "survey_123",
      }),
      "Response pipeline job hit database pool exhaustion and will be retried"
    );
    expect(mockLoggerError).not.toHaveBeenCalledWith(
      expect.objectContaining({
        err: poolExhaustionError,
      }),
      "Response pipeline job failed"
    );
  });
});
