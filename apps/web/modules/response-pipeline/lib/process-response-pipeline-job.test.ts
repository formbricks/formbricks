import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TResponsePipelineJobData } from "@formbricks/jobs";
import { FollowUpSendError } from "@/modules/survey/follow-ups/types/follow-up";
import { processResponsePipelineJob } from "./process-response-pipeline-job";

const {
  mockFetch,
  mockGetIntegrations,
  mockGetOrganizationByEnvironmentId,
  mockGetResponseCountBySurveyId,
  mockGetSurvey,
  mockHandleIntegrations,
  mockLoggerError,
  mockPrismaUserFindMany,
  mockPrismaWebhookFindMany,
  mockQueueAuditEventWithoutRequest,
  mockRecordResponseCreatedMeterEvent,
  mockSendFollowUpsForResponse,
  mockSendResponseFinishedEmail,
  mockSendTelemetryEvents,
  mockUpdateSurvey,
  mockValidateWebhookUrl,
} = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockGetIntegrations: vi.fn(),
  mockGetOrganizationByEnvironmentId: vi.fn(),
  mockGetResponseCountBySurveyId: vi.fn(),
  mockGetSurvey: vi.fn(),
  mockHandleIntegrations: vi.fn(),
  mockLoggerError: vi.fn(),
  mockPrismaUserFindMany: vi.fn(),
  mockPrismaWebhookFindMany: vi.fn(),
  mockQueueAuditEventWithoutRequest: vi.fn(),
  mockRecordResponseCreatedMeterEvent: vi.fn(),
  mockSendFollowUpsForResponse: vi.fn(),
  mockSendResponseFinishedEmail: vi.fn(),
  mockSendTelemetryEvents: vi.fn(),
  mockUpdateSurvey: vi.fn(),
  mockValidateWebhookUrl: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    webhook: {
      findMany: mockPrismaWebhookFindMany,
    },
    user: {
      findMany: mockPrismaUserFindMany,
    },
  },
}));

vi.mock("./handle-integrations", () => ({
  handleIntegrations: mockHandleIntegrations,
}));

vi.mock("./telemetry", () => ({
  sendTelemetryEvents: mockSendTelemetryEvents,
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByEnvironmentId: mockGetOrganizationByEnvironmentId,
}));

vi.mock("@/lib/integration/service", () => ({
  getIntegrations: mockGetIntegrations,
}));

vi.mock("@/lib/response/service", () => ({
  getResponseCountBySurveyId: mockGetResponseCountBySurveyId,
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: mockGetSurvey,
  updateSurvey: mockUpdateSurvey,
}));

vi.mock("@/lib/utils/validate-webhook-url", () => ({
  validateWebhookUrl: mockValidateWebhookUrl,
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

vi.mock("@formbricks/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: mockLoggerError,
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const baseData: TResponsePipelineJobData = {
  environmentId: "env_123",
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
  queueName: "background-jobs",
};

const organization = {
  billing: {
    stripeCustomerId: "cus_123",
  },
  id: "org_123",
};

const survey = {
  autoComplete: null,
  createdAt: new Date("2026-04-01T10:00:00.000Z"),
  environmentId: "env_123",
  followUps: [],
  id: "survey_123",
  name: "Test survey",
  status: "inProgress",
  type: "app",
  updatedAt: new Date("2026-04-01T10:00:00.000Z"),
};

describe("processResponsePipelineJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrganizationByEnvironmentId.mockResolvedValue(organization);
    mockGetSurvey.mockResolvedValue(survey);
    mockGetIntegrations.mockResolvedValue([]);
    mockPrismaWebhookFindMany.mockResolvedValue([]);
    mockPrismaUserFindMany.mockResolvedValue([]);
    mockGetResponseCountBySurveyId.mockResolvedValue(1);
    mockHandleIntegrations.mockResolvedValue(undefined);
    mockValidateWebhookUrl.mockResolvedValue(undefined);
    mockQueueAuditEventWithoutRequest.mockResolvedValue(undefined);
    mockRecordResponseCreatedMeterEvent.mockResolvedValue(undefined);
    mockSendResponseFinishedEmail.mockResolvedValue(undefined);
    mockSendFollowUpsForResponse.mockResolvedValue({ ok: true, data: [] });
    mockSendTelemetryEvents.mockResolvedValue(undefined);
    mockUpdateSurvey.mockResolvedValue(undefined);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });
    global.fetch = mockFetch as typeof global.fetch;
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
        environmentId: "env_123",
        triggers: { has: "responseCreated" },
      },
    });
    expect(mockValidateWebhookUrl).toHaveBeenCalledWith("https://example.com/webhook");
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

  test("processes responseFinished jobs and preserves legacy side effects", async () => {
    mockGetIntegrations.mockResolvedValue([{ id: "integration_123", type: "slack" }]);
    mockGetSurvey.mockResolvedValue({
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
    expect(mockSendFollowUpsForResponse).toHaveBeenCalledWith("response_123");
    expect(mockSendResponseFinishedEmail).toHaveBeenCalledWith(
      "owner@example.com",
      "en",
      "env_123",
      expect.objectContaining({ id: "survey_123" }),
      baseData.response,
      1
    );
    expect(mockUpdateSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "survey_123",
        status: "completed",
      })
    );
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

  test("logs partial downstream failures without failing the job", async () => {
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
    mockValidateWebhookUrl.mockRejectedValue(new Error("invalid webhook"));
    mockSendResponseFinishedEmail.mockRejectedValue(new Error("smtp failed"));
    mockSendFollowUpsForResponse.mockResolvedValue({
      ok: false,
      error: {
        code: FollowUpSendError.FOLLOW_UP_NOT_ALLOWED,
        message: "not allowed",
      },
    });
    mockUpdateSurvey.mockRejectedValue(new Error("update failed"));
    mockGetSurvey.mockResolvedValue({
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
        webhookId: "webhook_123",
      }),
      "Response pipeline webhook delivery failed"
    );
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
    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failure",
      })
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

  test("logs non-success webhook responses without failing the job", async () => {
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

    await expect(processResponsePipelineJob(baseData, baseContext)).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        webhookId: "webhook_123",
      }),
      "Response pipeline webhook delivery failed"
    );
  });

  test("fails fast on preflight mismatches", async () => {
    mockGetSurvey.mockResolvedValue({
      ...survey,
      environmentId: "env_other",
    });

    await expect(processResponsePipelineJob(baseData, baseContext)).rejects.toThrow(
      "Survey survey_123 does not belong to environment env_123"
    );

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        environmentId: "env_123",
        err: expect.any(Error),
        jobId: "job_123",
        responseId: "response_123",
        surveyId: "survey_123",
      }),
      "Response pipeline job failed"
    );
  });
});
