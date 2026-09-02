import { createHash } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TResponsePipelineJobData } from "@formbricks/jobs";
import { FollowUpSendError } from "@/modules/survey/follow-ups/types/follow-up";
import { processResponsePipelineJob } from "./process-response-pipeline-job";

// vitestSetup.ts stubs crypto.createHash to a constant for the license checks. The webhook-id derivation
// is a subject of this suite, so this file uses the real implementation.
vi.mock("node:crypto", async (importOriginal) => await importOriginal());

const {
  mockCaptureSurveyResponsePostHogEvent,
  mockEnqueueResponseCompletedWorkflowRuns,
  mockEnqueueWebhookDeliveryJob,
  mockGetIntegrations,
  mockGetFinishedResponseCountBySurveyId,
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
} = vi.hoisted(() => {
  process.env.HUB_API_URL ??= "https://hub.test";

  return {
    mockCaptureSurveyResponsePostHogEvent: vi.fn(),
    mockEnqueueResponseCompletedWorkflowRuns: vi.fn(),
    mockEnqueueWebhookDeliveryJob: vi.fn(),
    mockGetIntegrations: vi.fn(),
    mockGetFinishedResponseCountBySurveyId: vi.fn(),
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
  enqueueWebhookDeliveryJob: mockEnqueueWebhookDeliveryJob,
}));

vi.mock(import("@/lib/constants"), async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    POSTHOG_KEY: undefined,
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

vi.mock("@/modules/survey/lib/response", () => ({
  getFinishedResponseCountBySurveyId: mockGetFinishedResponseCountBySurveyId,
}));

vi.mock("./posthog", () => ({
  captureSurveyResponsePostHogEvent: mockCaptureSurveyResponsePostHogEvent,
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

vi.mock("@/modules/ee/workflows/lib/runner/enqueue-response-completed-runs", () => ({
  enqueueResponseCompletedWorkflowRuns: mockEnqueueResponseCompletedWorkflowRuns,
}));

vi.mock("@/modules/ee/workflows/lib/runner/dispatch", () => ({
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
  displayTimeZone: null,
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

const webhookRow = { id: "webhook_123" };

const expectedWebhookMessageId = (jobId: string, webhookId: string, event: string): string =>
  createHash("sha256").update(`${jobId}:${webhookId}:${event}`).digest("hex");

describe("processResponsePipelineJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaOrganizationFindFirst.mockResolvedValue(organization);
    mockPrismaSurveyFindUnique.mockResolvedValue(survey);
    mockGetIntegrations.mockResolvedValue([]);
    mockPrismaWebhookFindMany.mockResolvedValue([]);
    mockPrismaUserFindMany.mockResolvedValue([]);
    mockGetResponseCountBySurveyId.mockResolvedValue(7);
    mockGetFinishedResponseCountBySurveyId.mockResolvedValue(1);
    mockHandleIntegrations.mockResolvedValue(undefined);
    mockEnqueueWebhookDeliveryJob.mockResolvedValue({ id: "whd-job_123-webhook_123" });
    mockQueueAuditEventWithoutRequest.mockResolvedValue(undefined);
    mockRecordResponseCreatedMeterEvent.mockResolvedValue(undefined);
    mockSendResponseFinishedEmail.mockResolvedValue(undefined);
    mockSendFollowUpsForResponse.mockResolvedValue({ ok: true, data: [] });
    mockEnqueueResponseCompletedWorkflowRuns.mockResolvedValue(undefined);
    mockSendTelemetryEvents.mockResolvedValue(undefined);
    mockPrismaSurveyUpdate.mockResolvedValue(undefined);
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
        // The runner gates on the organization's workflows entitlement, so the pipeline must
        // thread the resolved organization through.
        organizationId: "org_123",
      })
    );
  });

  test("does not invoke the workflow runner on responseCreated", async () => {
    await expect(processResponsePipelineJob(baseData, baseContext)).resolves.toBeUndefined();
    expect(mockEnqueueResponseCompletedWorkflowRuns).not.toHaveBeenCalled();
  });

  test("rethrows a transient DB pool-exhaustion error from the workflow runner so the job retries", async () => {
    mockEnqueueResponseCompletedWorkflowRuns.mockRejectedValue(
      new Error("Timed out fetching a new connection from the connection pool")
    );

    await expect(
      processResponsePipelineJob({ ...baseData, event: "responseFinished" }, baseContext)
    ).rejects.toThrow(/connection pool/i);
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

  test("processes responseCreated jobs with webhook fan-out, metering, and telemetry side effects", async () => {
    mockPrismaWebhookFindMany.mockResolvedValue([webhookRow]);

    await expect(processResponsePipelineJob(baseData, baseContext)).resolves.toBeUndefined();

    // Ids only — the delivery job re-reads url and secret, so neither is loaded here or put in Redis.
    expect(mockPrismaWebhookFindMany).toHaveBeenCalledWith({
      where: {
        OR: [{ surveyIds: { has: "survey_123" } }, { surveyIds: { isEmpty: true } }],
        workspaceId: "workspace_123",
        triggers: { has: "responseCreated" },
      },
      select: { id: true },
    });
    expect(mockEnqueueWebhookDeliveryJob).toHaveBeenCalledTimes(1);
    expect(mockEnqueueWebhookDeliveryJob).toHaveBeenCalledWith(
      {
        webhookId: "webhook_123",
        workspaceId: "workspace_123",
        surveyId: "survey_123",
        event: "responseCreated",
        webhookMessageId: expectedWebhookMessageId("job_123", "webhook_123", "responseCreated"),
        response: baseData.response,
        survey: {
          name: "Test survey",
          type: "app",
          status: "inProgress",
          createdAt: survey.createdAt,
          updatedAt: survey.updatedAt,
        },
      },
      { jobId: "whd-job_123-webhook_123" }
    );
    expect(mockRecordResponseCreatedMeterEvent).toHaveBeenCalledWith({
      createdAt: baseData.response.createdAt,
      responseId: "response_123",
      stripeCustomerId: "cus_123",
    });
    expect(mockSendTelemetryEvents).toHaveBeenCalledTimes(1);
    expect(mockHandleIntegrations).not.toHaveBeenCalled();
  });

  test("derives a stable webhook id from the pipeline job across retry attempts", async () => {
    mockPrismaWebhookFindMany.mockResolvedValue([webhookRow]);

    await expect(processResponsePipelineJob(baseData, baseContext)).resolves.toBeUndefined();
    await expect(processResponsePipelineJob(baseData, finalAttemptContext)).resolves.toBeUndefined();

    const messageIds = mockEnqueueWebhookDeliveryJob.mock.calls.map(([payload]) => payload.webhookMessageId);
    const jobIds = mockEnqueueWebhookDeliveryJob.mock.calls.map(([, options]) => options.jobId);

    // The exact pre-fan-out derivation, pinned: receivers dedupe on it.
    expect(messageIds).toEqual([
      expectedWebhookMessageId("job_123", "webhook_123", "responseCreated"),
      expectedWebhookMessageId("job_123", "webhook_123", "responseCreated"),
    ]);
    // Same deterministic child jobId on the retry, so BullMQ dedupes the re-enqueue.
    expect(jobIds).toEqual(["whd-job_123-webhook_123", "whd-job_123-webhook_123"]);
  });

  test("enqueues one delivery job per matching webhook with distinct ids", async () => {
    mockPrismaWebhookFindMany.mockResolvedValue([
      { id: "webhook_a" },
      { id: "webhook_b" },
      { id: "webhook_c" },
    ]);

    await expect(processResponsePipelineJob(baseData, baseContext)).resolves.toBeUndefined();

    expect(mockEnqueueWebhookDeliveryJob).toHaveBeenCalledTimes(3);
    const jobIds = mockEnqueueWebhookDeliveryJob.mock.calls.map(([, options]) => options.jobId);
    const messageIds = mockEnqueueWebhookDeliveryJob.mock.calls.map(([payload]) => payload.webhookMessageId);
    expect(jobIds).toEqual(["whd-job_123-webhook_a", "whd-job_123-webhook_b", "whd-job_123-webhook_c"]);
    expect(new Set(messageIds).size).toBe(3);
  });

  test("does not enqueue any delivery job when no webhook matches", async () => {
    mockPrismaWebhookFindMany.mockResolvedValue([]);

    await expect(processResponsePipelineJob(baseData, baseContext)).resolves.toBeUndefined();

    expect(mockEnqueueWebhookDeliveryJob).not.toHaveBeenCalled();
  });

  test("processes responseFinished jobs and preserves legacy side effects", async () => {
    mockGetIntegrations.mockResolvedValue([{ id: "integration_123", type: "slack" }]);
    mockPrismaSurveyFindUnique.mockResolvedValue({
      ...survey,
      autoComplete: 1,
      followUps: [{ id: "followup_123" }],
    });
    mockPrismaWebhookFindMany.mockResolvedValue([webhookRow]);
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
      },
      "UTC"
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
      // The notification email deliberately reports the *total* response count, not the
      // completed-only count the response limit uses.
      7
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

  test("only counts finished responses towards the auto-complete response limit", async () => {
    // Total responses (starts) far exceed the limit, but finished responses do not.
    mockGetResponseCountBySurveyId.mockResolvedValue(500);
    mockGetFinishedResponseCountBySurveyId.mockResolvedValue(3);
    mockPrismaSurveyFindUnique.mockResolvedValue({
      ...survey,
      autoComplete: 5,
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

    // The auto-complete decision must be based on finished responses only.
    expect(mockGetFinishedResponseCountBySurveyId).toHaveBeenCalledWith("survey_123");
    // 3 finished responses < limit of 5 → the survey must stay open.
    expect(mockPrismaSurveyUpdate).not.toHaveBeenCalled();
  });

  test("auto-completes the survey once finished responses reach the limit", async () => {
    mockGetFinishedResponseCountBySurveyId.mockResolvedValue(5);
    mockPrismaSurveyFindUnique.mockResolvedValue({
      ...survey,
      autoComplete: 5,
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

    expect(mockPrismaSurveyUpdate).toHaveBeenCalledWith({
      data: {
        status: "completed",
      },
      where: {
        id: "survey_123",
      },
    });
  });

  test("does not count finished responses when no response limit is set", async () => {
    // The default survey fixture has autoComplete: null.
    await expect(
      processResponsePipelineJob(
        {
          ...baseData,
          event: "responseFinished",
        },
        baseContext
      )
    ).resolves.toBeUndefined();

    expect(mockGetFinishedResponseCountBySurveyId).not.toHaveBeenCalled();
    expect(mockPrismaSurveyUpdate).not.toHaveBeenCalled();
  });

  test("does not re-close a survey that is already completed", async () => {
    mockGetFinishedResponseCountBySurveyId.mockResolvedValue(50);
    mockPrismaSurveyFindUnique.mockResolvedValue({
      ...survey,
      autoComplete: 5,
      status: "completed",
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

    expect(mockGetFinishedResponseCountBySurveyId).not.toHaveBeenCalled();
    expect(mockPrismaSurveyUpdate).not.toHaveBeenCalled();
    expect(mockQueueAuditEventWithoutRequest).not.toHaveBeenCalled();
  });

  test("does not count total responses when nobody subscribes to notifications", async () => {
    // No user has response notifications enabled, so nothing consumes the total count.
    await expect(
      processResponsePipelineJob(
        {
          ...baseData,
          event: "responseFinished",
        },
        baseContext
      )
    ).resolves.toBeUndefined();

    expect(mockPrismaUserFindMany).toHaveBeenCalled();
    expect(mockGetResponseCountBySurveyId).not.toHaveBeenCalled();
    expect(mockSendResponseFinishedEmail).not.toHaveBeenCalled();
  });

  test("skips auto-complete when the finished response count cannot be loaded", async () => {
    const countError = new Error("count offline");
    mockPrismaSurveyFindUnique.mockResolvedValue({
      ...survey,
      autoComplete: 1,
    });
    mockGetFinishedResponseCountBySurveyId.mockRejectedValue(countError);

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
        autoCompleteThreshold: 1,
        err: countError,
      }),
      "Response pipeline survey auto-complete skipped because the finished response count could not be loaded"
    );
    expect(mockPrismaSurveyUpdate).not.toHaveBeenCalled();
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

  test("fails the job before the final attempt when a webhook delivery cannot be enqueued", async () => {
    const enqueueError = new Error("redis unavailable");
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
    mockPrismaWebhookFindMany.mockResolvedValue([webhookRow]);
    mockEnqueueWebhookDeliveryJob.mockRejectedValue(enqueueError);

    await expect(
      processResponsePipelineJob(
        {
          ...baseData,
          event: "responseFinished",
        },
        baseContext
      )
    ).rejects.toThrow("redis unavailable");

    // The retry re-runs the fan-out with the same deterministic child ids, so failing here is safe.
    expect(mockHandleIntegrations).not.toHaveBeenCalled();
    expect(mockSendFollowUpsForResponse).not.toHaveBeenCalled();
    expect(mockSendResponseFinishedEmail).not.toHaveBeenCalled();
    expect(mockPrismaSurveyUpdate).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: enqueueError,
        jobId: "job_123",
      }),
      "Response pipeline job failed"
    );
  });

  test("continues responseFinished side effects when the fan-out fails on the final attempt", async () => {
    const enqueueError = new Error("redis unavailable");
    mockGetIntegrations.mockResolvedValue([{ id: "integration_123", type: "slack" }]);
    mockPrismaSurveyFindUnique.mockResolvedValue({
      ...survey,
      autoComplete: 1,
      followUps: [{ id: "followup_123" }],
    });
    mockPrismaWebhookFindMany.mockResolvedValue([webhookRow]);
    mockPrismaUserFindMany.mockResolvedValue([
      {
        email: "owner@example.com",
        locale: "en",
      },
    ]);
    mockEnqueueWebhookDeliveryJob.mockRejectedValue(enqueueError);

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
      "Response pipeline webhook delivery enqueue exhausted retries; continuing with remaining side effects"
    );
  });

  test("threads the organization display time zone into integrations", async () => {
    mockPrismaOrganizationFindFirst.mockResolvedValue({
      ...organization,
      displayTimeZone: "Asia/Manila",
    });
    mockGetIntegrations.mockResolvedValue([{ id: "integration_123", type: "slack" }]);

    await expect(
      processResponsePipelineJob(
        {
          ...baseData,
          event: "responseFinished",
        },
        baseContext
      )
    ).resolves.toBeUndefined();

    expect(mockHandleIntegrations).toHaveBeenCalledWith(
      [{ id: "integration_123", type: "slack" }],
      expect.objectContaining({ event: "responseFinished" }),
      expect.anything(),
      "Asia/Manila"
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
    mockPrismaWebhookFindMany.mockResolvedValue([webhookRow]);
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

    expect(mockEnqueueWebhookDeliveryJob).toHaveBeenCalledTimes(1);
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
    mockPrismaWebhookFindMany.mockResolvedValue([webhookRow]);
    // The total count is only looked up when a notification recipient consumes it.
    mockPrismaUserFindMany.mockResolvedValue([
      {
        email: "owner@example.com",
        locale: "en",
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

    expect(mockEnqueueWebhookDeliveryJob).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: responseCountError,
        event: "responseFinished",
        jobId: "job_123",
      }),
      "Response pipeline response count lookup failed"
    );
    expect(mockSendResponseFinishedEmail).not.toHaveBeenCalled();
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

  test("continues responseCreated side effects when the fan-out fails on the final attempt", async () => {
    mockPrismaWebhookFindMany.mockResolvedValue([webhookRow]);
    mockEnqueueWebhookDeliveryJob.mockRejectedValue(new Error("redis unavailable"));

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
      "Response pipeline webhook delivery enqueue exhausted retries; continuing with remaining side effects"
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
