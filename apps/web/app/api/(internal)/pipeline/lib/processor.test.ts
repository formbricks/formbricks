import { PipelineTriggers, Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { TResponse } from "@formbricks/types/responses";
import { TPipelineInput } from "@/app/lib/types/pipelines";
import { getIntegrations } from "@/lib/integration/service";
import { validateWebhookUrl } from "@/lib/utils/validate-webhook-url";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { recordResponseCreatedMeterEvent } from "@/modules/ee/billing/lib/metering";
import { sendResponseFinishedEmail } from "@/modules/email";
import { sendFollowUpsForResponse } from "@/modules/survey/follow-ups/lib/follow-ups";
import { handleIntegrations } from "./handleIntegrations";
import { isPipelinePoolExhaustionError, processPipelineJob } from "./processor";
import { sendTelemetryEvents } from "./telemetry";

vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findFirst: vi.fn(),
    },
    survey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    webhook: {
      findMany: vi.fn(),
    },
    response: {
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/integration/service", () => ({
  getIntegrations: vi.fn(),
}));

vi.mock("@/lib/utils/validate-webhook-url", () => ({
  validateWebhookUrl: vi.fn(),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/modules/ee/billing/lib/metering", () => ({
  recordResponseCreatedMeterEvent: vi.fn(),
}));

vi.mock("@/modules/email", () => ({
  sendResponseFinishedEmail: vi.fn(),
}));

vi.mock("@/modules/survey/follow-ups/lib/follow-ups", () => ({
  sendFollowUpsForResponse: vi.fn(),
}));

vi.mock("./handleIntegrations", () => ({
  handleIntegrations: vi.fn(),
}));

vi.mock("./telemetry", () => ({
  sendTelemetryEvents: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const baseResponse = {
  id: "cm8cmpnjj000108jfdr9dfqe6",
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-01T00:00:00.000Z"),
  data: {},
  contactAttributes: {},
  meta: {},
  variables: {},
} as TResponse;

const baseJob: TPipelineInput = {
  event: PipelineTriggers.responseCreated,
  surveyId: "cm8ckvchx000008lb710n0gdn",
  environmentId: "cm8cmp9hp000008jf7l570ml2",
  response: baseResponse,
};

const survey = {
  id: baseJob.surveyId,
  environmentId: baseJob.environmentId,
  name: "Pipeline survey",
  type: "app",
  status: "inProgress",
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-01T00:00:00.000Z"),
  blocks: [],
  hiddenFields: { enabled: false, fieldIds: [] },
  variables: [],
  followUps: [{ id: "follow-up-1" }],
  autoComplete: 2,
  languages: [],
};

describe("processPipelineJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(prisma.organization.findFirst).mockResolvedValue({
      id: "org_1",
      billing: {
        stripeCustomerId: "cus_123",
      },
    } as any);
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(survey as any);
    vi.mocked(prisma.webhook.findMany).mockResolvedValue([
      {
        id: "webhook_1",
        url: "https://example.com/webhook",
        secret: null,
      },
    ] as any);
    vi.mocked(prisma.response.count).mockResolvedValue(2);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { email: "owner@example.com", locale: "en-US" },
    ] as any);
    vi.mocked(prisma.survey.update).mockResolvedValue({ id: survey.id } as any);
    vi.mocked(getIntegrations).mockResolvedValue([{ id: "integration_1" }] as any);
    vi.mocked(validateWebhookUrl).mockResolvedValue(undefined);
    vi.mocked(queueAuditEvent).mockResolvedValue(undefined);
    vi.mocked(recordResponseCreatedMeterEvent).mockReturnValue(Promise.resolve(undefined));
    vi.mocked(sendResponseFinishedEmail).mockResolvedValue(undefined);
    vi.mocked(sendFollowUpsForResponse).mockResolvedValue({ ok: true, data: undefined } as any);
    vi.mocked(handleIntegrations).mockResolvedValue(undefined);
    vi.mocked(sendTelemetryEvents).mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("processes responseCreated jobs without inline retries", async () => {
    await processPipelineJob(baseJob);

    expect(prisma.organization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.any(Object),
        select: expect.any(Object),
      })
    );
    expect(prisma.survey.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: baseJob.surveyId },
        select: expect.any(Object),
      })
    );
    expect(prisma.webhook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          environmentId: baseJob.environmentId,
          triggers: { has: baseJob.event },
        }),
      })
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        method: "POST",
      })
    );
    expect(recordResponseCreatedMeterEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeCustomerId: "cus_123",
        responseId: baseJob.response.id,
      })
    );
    expect(sendTelemetryEvents).toHaveBeenCalledTimes(1);
    expect(prisma.response.count).not.toHaveBeenCalled();
  });

  test("processes responseFinished jobs with integrations, notifications, and auto-complete", async () => {
    await processPipelineJob({
      ...baseJob,
      event: PipelineTriggers.responseFinished,
    });

    expect(getIntegrations).toHaveBeenCalledWith(baseJob.environmentId);
    expect(prisma.response.count).toHaveBeenCalledWith({
      where: {
        surveyId: baseJob.surveyId,
      },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              memberships: {
                some: expect.objectContaining({
                  role: {
                    in: ["owner", "manager"],
                  },
                }),
              },
            }),
          ]),
        }),
      })
    );
    expect(handleIntegrations).toHaveBeenCalledTimes(1);
    expect(sendFollowUpsForResponse).toHaveBeenCalledWith(baseJob.response.id);
    expect(sendResponseFinishedEmail).toHaveBeenCalledWith(
      "owner@example.com",
      "en-US",
      baseJob.environmentId,
      expect.any(Object),
      baseJob.response,
      2
    );
    expect(prisma.survey.update).toHaveBeenCalledWith({
      where: {
        id: baseJob.surveyId,
      },
      data: {
        status: "completed",
      },
    });
    expect(queueAuditEvent).toHaveBeenCalledTimes(1);
  });

  test("logs webhook delivery failures for non-2xx responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("upstream error", {
          status: 500,
          statusText: "Internal Server Error",
        })
      )
    );

    await processPipelineJob(baseJob);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        webhookId: "webhook_1",
        url: "https://example.com/webhook",
      }),
      "Webhook call failed"
    );
  });

  test("awaits metering completion before finishing responseCreated jobs", async () => {
    let resolveMeterEvent: (() => void) | undefined;
    vi.mocked(recordResponseCreatedMeterEvent).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveMeterEvent = resolve;
        })
    );

    const jobPromise = processPipelineJob(baseJob);

    await vi.waitFor(() => {
      expect(recordResponseCreatedMeterEvent).toHaveBeenCalledTimes(1);
    });

    let jobSettled = false;
    void jobPromise.then(() => {
      jobSettled = true;
    });

    await Promise.resolve();

    expect(jobSettled).toBe(false);

    resolveMeterEvent?.();

    await jobPromise;
    expect(sendTelemetryEvents).toHaveBeenCalledTimes(1);
  });
});

describe("isPipelinePoolExhaustionError", () => {
  test("returns true for Prisma pool exhaustion errors", () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Pool timeout", {
      code: "P2024",
      clientVersion: "test",
    });

    expect(isPipelinePoolExhaustionError(prismaError)).toBe(true);
  });

  test("returns true for wrapped DatabaseError messages", () => {
    const error = new DatabaseError(
      "Timed out fetching a new connection from the connection pool. Current timeout: 10"
    );

    expect(isPipelinePoolExhaustionError(error)).toBe(true);
  });

  test("returns false for unrelated errors", () => {
    expect(isPipelinePoolExhaustionError(new Error("boom"))).toBe(false);
  });
});

describe("processPipelineJob pool exhaustion handling", () => {
  test("logs a warning and rethrows pool exhaustion errors", async () => {
    const poolError = new Prisma.PrismaClientKnownRequestError("Pool timeout", {
      code: "P2024",
      clientVersion: "test",
    });

    vi.mocked(prisma.organization.findFirst).mockRejectedValue(poolError);

    await expect(processPipelineJob(baseJob)).rejects.toBe(poolError);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: poolError,
        event: baseJob.event,
        surveyId: baseJob.surveyId,
        environmentId: baseJob.environmentId,
        responseId: baseJob.response.id,
      }),
      "Pipeline job hit database pool exhaustion and will be retried"
    );
  });
});
