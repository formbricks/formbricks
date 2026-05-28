import "server-only";
import { PipelineTriggers, Prisma, type Webhook } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@formbricks/database";
import { type JobHandler, type TResponsePipelineJobData, UnrecoverableError } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { type TUserLocale, ZUserLocale } from "@formbricks/types/user";
import { DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS, POSTHOG_KEY } from "@/lib/constants";
import { generateStandardWebhookSignature } from "@/lib/crypto";
import { handleFeedbackSourcePipeline } from "@/lib/feedback-source/pipeline-handler";
import { getIntegrations } from "@/lib/integration/service";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { createPinnedDispatcher, validateAndResolveWebhookUrl } from "@/lib/utils/validate-webhook-url";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { type TAuditStatus, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { recordResponseCreatedMeterEvent } from "@/modules/ee/billing/lib/metering";
import { sendResponseFinishedEmail } from "@/modules/email";
import { captureSurveyResponsePostHogEvent } from "@/modules/response-pipeline/lib/posthog";
import { resolveStorageUrlsInObject } from "@/modules/storage/utils";
import { sendFollowUpsForResponse } from "@/modules/survey/follow-ups/lib/follow-ups";
import { FollowUpSendError } from "@/modules/survey/follow-ups/types/follow-up";
import { handleIntegrations } from "./handle-integrations";
import { sendTelemetryEvents } from "./telemetry";

const WEBHOOK_TIMEOUT_MS = 5_000;
const DEFAULT_NOTIFICATION_LOCALE: TUserLocale = "en-US";

const pipelineOrganizationSelect = {
  id: true,
  billing: {
    select: {
      stripeCustomerId: true,
    },
  },
} satisfies Prisma.OrganizationSelect;

const pipelineSurveySelect = {
  id: true,
  workspaceId: true,
  name: true,
  type: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  blocks: true,
  hiddenFields: true,
  variables: true,
  followUps: true,
  autoComplete: true,
  languages: {
    select: {
      default: true,
      enabled: true,
      language: {
        select: {
          id: true,
          code: true,
          alias: true,
          createdAt: true,
          updatedAt: true,
          workspaceId: true,
        },
      },
    },
  },
} satisfies Prisma.SurveySelect;

type TPipelineOrganization = Prisma.OrganizationGetPayload<{ select: typeof pipelineOrganizationSelect }>;
type TPipelineSurvey = Prisma.SurveyGetPayload<{ select: typeof pipelineSurveySelect }>;

const getOrganizationForPipeline = async (workspaceId: string): Promise<TPipelineOrganization | null> =>
  prisma.organization.findFirst({
    where: {
      workspaces: {
        some: {
          id: workspaceId,
        },
      },
    },
    select: pipelineOrganizationSelect,
  });

const getSurveyForPipeline = async (surveyId: string): Promise<TPipelineSurvey | null> =>
  prisma.survey.findUnique({
    where: {
      id: surveyId,
    },
    select: pipelineSurveySelect,
  });

const getPipelineLogContext = (
  data: TResponsePipelineJobData,
  context: Parameters<JobHandler<TResponsePipelineJobData>>[1]
) => ({
  attempt: context.attempt,
  workspaceId: data.workspaceId,
  event: data.event,
  jobId: context.jobId,
  jobName: context.jobName,
  maxAttempts: context.maxAttempts,
  queueName: context.queueName,
  responseId: data.response.id,
  surveyId: data.surveyId,
});

const toError = (error: unknown, fallbackMessage: string): Error =>
  error instanceof Error ? error : new Error(fallbackMessage);

const toUserLocale = (locale: string): TUserLocale => {
  const parsedLocale = ZUserLocale.safeParse(locale);
  return parsedLocale.success ? parsedLocale.data : DEFAULT_NOTIFICATION_LOCALE;
};

export const isPipelinePoolExhaustionError = (error: unknown): boolean => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2024") {
    return true;
  }

  if (error instanceof DatabaseError || error instanceof Error) {
    return /Timed out fetching a new connection from the connection pool|connection pool timeout/i.test(
      error.message
    );
  }

  return false;
};

const createWebhookMessageId = ({
  event,
  jobId,
  webhookId,
}: {
  event: TResponsePipelineJobData["event"];
  jobId: string;
  webhookId: string;
}): string => createHash("sha256").update(`${jobId}:${webhookId}:${event}`).digest("hex");

type WebhookFetchOptions = RequestInit & {
  dispatcher?: ReturnType<typeof createPinnedDispatcher>;
};

const fetchWithTimeout = async (
  url: string,
  options: WebhookFetchOptions,
  timeoutMs: number = WEBHOOK_TIMEOUT_MS
): Promise<Response> => {
  const abortController = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([options.signal, abortController.signal])
    : abortController.signal;
  const timeoutId = setTimeout(() => {
    abortController.abort(new Error("Timeout"));
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal,
    } as RequestInit);
  } finally {
    clearTimeout(timeoutId);
  }
};

const getWebhooksForPipeline = async (
  workspaceId: string,
  event: PipelineTriggers,
  surveyId: string
): Promise<Webhook[]> => {
  return await prisma.webhook.findMany({
    where: {
      workspaceId,
      triggers: { has: event },
      OR: [{ surveyIds: { has: surveyId } }, { surveyIds: { isEmpty: true } }],
    },
  });
};

const createWebhookDeliveryTask = async ({
  webhook,
  data,
  survey,
  logContext,
}: {
  webhook: Webhook;
  data: TResponsePipelineJobData;
  survey: TPipelineSurvey;
  logContext: ReturnType<typeof getPipelineLogContext>;
}): Promise<void> => {
  try {
    const body = JSON.stringify({
      webhookId: webhook.id,
      event: data.event,
      data: {
        ...data.response,
        data: resolveStorageUrlsInObject(data.response.data),
        survey: {
          title: survey?.name,
          type: survey?.type,
          status: survey?.status,
          createdAt: survey?.createdAt,
          updatedAt: survey?.updatedAt,
        },
      },
    });

    const webhookMessageId = createWebhookMessageId({
      event: data.event,
      jobId: logContext.jobId,
      webhookId: webhook.id,
    });
    const webhookTimestamp = Math.floor(Date.now() / 1000);
    const requestHeaders: Record<string, string> = {
      "content-type": "application/json",
      "webhook-id": webhookMessageId,
      "webhook-timestamp": webhookTimestamp.toString(),
    };

    if (webhook.secret) {
      requestHeaders["webhook-signature"] = generateStandardWebhookSignature(
        webhookMessageId,
        webhookTimestamp,
        body,
        webhook.secret
      );
    }

    const address = await validateAndResolveWebhookUrl(webhook.url);
    // Pin TCP connect to the validated IP — closes DNS-rebinding TOCTOU between
    // validation and fetch. Skip pinning when address is null (DANGEROUSLY flag +
    // blocked name resolved via /etc/hosts).
    const dispatcher = address ? createPinnedDispatcher(address) : undefined;
    // `redirect: "manual"` blocks 30x-based SSRF to private/internal hosts.
    // Gated on the same env var as URL validation for self-hosters who opted in.
    const redirectMode: RequestRedirect = DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS ? "follow" : "manual";

    try {
      const response = await fetchWithTimeout(webhook.url, {
        method: "POST",
        headers: requestHeaders,
        body,
        redirect: redirectMode,
        dispatcher,
      });

      // With `redirect: "manual"`, undici returns the actual 30x (not opaqueredirect).
      // Treat as delivery failure so redirect-based SSRF cannot silently succeed.
      if (response.status >= 300 && response.status < 400) {
        throw new Error(`Webhook delivery blocked: redirect status ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(`Webhook delivery failed with status ${response.status}`);
      }
    } finally {
      try {
        await dispatcher?.destroy();
      } catch (cleanupError) {
        logger.warn(
          {
            ...logContext,
            err: cleanupError,
            webhookId: webhook.id,
            webhookUrl: webhook.url,
          },
          "Response pipeline webhook dispatcher cleanup failed"
        );
      }
    }
  } catch (error) {
    logger.error(
      {
        ...logContext,
        err: error,
        webhookId: webhook.id,
        webhookUrl: webhook.url,
      },
      "Response pipeline webhook delivery failed"
    );
    throw error;
  }
};

const deliverWebhooks = async ({
  data,
  logContext,
  survey,
  webhooks,
}: {
  data: TResponsePipelineJobData;
  logContext: ReturnType<typeof getPipelineLogContext>;
  survey: TPipelineSurvey;
  webhooks: Webhook[];
}): Promise<void> => {
  const results = await Promise.allSettled(
    webhooks.map((webhook) =>
      createWebhookDeliveryTask({
        webhook,
        data,
        survey,
        logContext,
      })
    )
  );

  const failedResults = results.filter((result) => result.status === "rejected");
  if (failedResults.length === 0) {
    return;
  }

  if (logContext.attempt < logContext.maxAttempts) {
    throw toError(failedResults[0].reason, "Response pipeline webhook delivery failed");
  }

  logger.error(
    {
      ...logContext,
      failedWebhookCount: failedResults.length,
    },
    "Response pipeline webhook delivery exhausted retries; continuing with remaining side effects"
  );
};

const loadResponseFinishedContext = async ({
  data,
  logContext,
  workspaceId,
}: {
  data: TResponsePipelineJobData;
  logContext: ReturnType<typeof getPipelineLogContext>;
  workspaceId: string;
}): Promise<{
  integrations: Awaited<ReturnType<typeof getIntegrations>>;
  responseCount: number | null;
}> => {
  const [integrationsResult, responseCountResult] = await Promise.allSettled([
    getIntegrations(workspaceId),
    getResponseCountBySurveyId(data.surveyId),
  ]);

  if (integrationsResult.status === "rejected") {
    logger.error(
      {
        ...logContext,
        err: integrationsResult.reason,
      },
      "Response pipeline integration lookup failed"
    );
  }

  if (responseCountResult.status === "rejected") {
    logger.error(
      {
        ...logContext,
        err: responseCountResult.reason,
      },
      "Response pipeline response count lookup failed"
    );
  }

  return {
    integrations: integrationsResult.status === "fulfilled" ? integrationsResult.value : [],
    responseCount: responseCountResult.status === "fulfilled" ? responseCountResult.value : null,
  };
};

const getUsersWithNotifications = async ({
  data,
  logContext,
  workspaceId,
}: {
  data: TResponsePipelineJobData;
  logContext: ReturnType<typeof getPipelineLogContext>;
  workspaceId: string;
}): Promise<Array<{ email: string; locale: TUserLocale }>> => {
  try {
    const users = await prisma.user.findMany({
      where: {
        memberships: {
          some: {
            organization: {
              workspaces: {
                some: {
                  id: workspaceId,
                },
              },
            },
          },
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
                      id: workspaceId,
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
                        id: workspaceId,
                      },
                    },
                  },
                },
              },
            },
          },
        ],
        notificationSettings: {
          path: ["alert", data.surveyId],
          equals: true,
        },
      },
      select: { email: true, locale: true },
    });

    return users.map((user) => ({
      email: user.email,
      locale: toUserLocale(user.locale),
    }));
  } catch (error) {
    logger.error(
      {
        ...logContext,
        err: error,
      },
      "Response pipeline notification recipient lookup failed"
    );

    return [];
  }
};

const handleFollowUpsSafely = async ({
  data,
  logContext,
  survey,
}: {
  data: TResponsePipelineJobData;
  logContext: ReturnType<typeof getPipelineLogContext>;
  survey: TPipelineSurvey;
}): Promise<void> => {
  if (!survey.followUps?.length) {
    return;
  }

  try {
    const followUpsResult = await sendFollowUpsForResponse(data.response.id);
    if (!followUpsResult.ok && followUpsResult.error.code !== FollowUpSendError.FOLLOW_UP_NOT_ALLOWED) {
      logger.error(
        {
          ...logContext,
          error: followUpsResult.error,
        },
        "Response pipeline follow-up delivery failed"
      );
    }
  } catch (error) {
    logger.error(
      {
        ...logContext,
        err: error,
      },
      "Response pipeline follow-up delivery failed"
    );
  }
};

const sendNotificationEmailsSafely = async ({
  data,
  logContext,
  responseCount,
  survey,
  usersWithNotifications,
  workspaceId,
}: {
  data: TResponsePipelineJobData;
  logContext: ReturnType<typeof getPipelineLogContext>;
  responseCount: number | null;
  survey: TPipelineSurvey;
  usersWithNotifications: Array<{ email: string; locale: TUserLocale }>;
  workspaceId: string;
}): Promise<void> => {
  if (responseCount === null) {
    if (usersWithNotifications.length > 0) {
      logger.error(
        {
          ...logContext,
          notificationRecipientCount: usersWithNotifications.length,
        },
        "Response pipeline notification emails skipped because the response count could not be loaded"
      );
    }

    return;
  }

  await Promise.all(
    usersWithNotifications.map(async (user) => {
      try {
        await sendResponseFinishedEmail(
          user.email,
          user.locale,
          workspaceId,
          survey,
          data.response,
          responseCount
        );
      } catch (error) {
        logger.error(
          {
            ...logContext,
            err: error,
            userEmail: user.email,
          },
          "Response pipeline notification email failed"
        );
      }
    })
  );
};

const handleSurveyAutoCompleteSafely = async ({
  logContext,
  organizationId,
  responseCount,
  survey,
}: {
  logContext: ReturnType<typeof getPipelineLogContext>;
  organizationId: string;
  responseCount: number | null;
  survey: TPipelineSurvey;
}): Promise<void> => {
  if (responseCount === null) {
    if (survey.autoComplete) {
      logger.error(
        {
          ...logContext,
          autoCompleteThreshold: survey.autoComplete,
        },
        "Response pipeline survey auto-complete skipped because the response count could not be loaded"
      );
    }

    return;
  }

  if (!survey.autoComplete || responseCount < survey.autoComplete) {
    return;
  }

  let logStatus: TAuditStatus = "success";

  try {
    await prisma.survey.update({
      where: {
        id: survey.id,
      },
      data: {
        status: "completed",
      },
    });
  } catch (error) {
    logStatus = "failure";
    logger.error(
      {
        ...logContext,
        err: error,
      },
      "Response pipeline survey auto-complete update failed"
    );
  }

  try {
    await queueAuditEventWithoutRequest({
      status: logStatus,
      action: "updated",
      targetType: "survey",
      userId: UNKNOWN_DATA,
      userType: "system",
      targetId: survey.id,
      organizationId,
      ...(logStatus === "success"
        ? {
            newObject: {
              status: "completed",
            },
          }
        : {}),
    });
  } catch (error) {
    logger.error(
      {
        ...logContext,
        auditStatus: logStatus,
        err: error,
      },
      "Response pipeline survey auto-complete audit log failed"
    );
  }
};

const runResponseFinishedSideEffects = async ({
  data,
  logContext,
  organizationId,
  survey,
  workspaceId,
}: {
  data: TResponsePipelineJobData;
  logContext: ReturnType<typeof getPipelineLogContext>;
  organizationId: string;
  survey: TPipelineSurvey;
  workspaceId: string;
}) => {
  const [{ integrations, responseCount }, usersWithNotifications] = await Promise.all([
    loadResponseFinishedContext({
      data,
      logContext,
      workspaceId,
    }),
    getUsersWithNotifications({
      data,
      logContext,
      workspaceId,
    }),
  ]);

  if (integrations.length > 0) {
    try {
      await handleIntegrations(integrations, data, survey);
    } catch (error) {
      logger.error(
        {
          ...logContext,
          err: error,
        },
        "Response pipeline integration handling failed"
      );
    }
  }

  try {
    await handleFeedbackSourcePipeline(data.response, survey, workspaceId);
  } catch (error) {
    logger.error(
      {
        ...logContext,
        err: error,
      },
      "Response pipeline feedbackSource handling failed"
    );
  }

  await handleFollowUpsSafely({
    data,
    logContext,
    survey,
  });

  await sendNotificationEmailsSafely({
    data,
    logContext,
    responseCount,
    survey,
    usersWithNotifications,
    workspaceId,
  });

  await handleSurveyAutoCompleteSafely({
    logContext,
    organizationId,
    responseCount,
    survey,
  });
};

const runResponseCreatedSideEffects = async ({
  data,
  logContext,
  organizationId,
  survey,
  stripeCustomerId,
}: {
  data: TResponsePipelineJobData;
  logContext: ReturnType<typeof getPipelineLogContext>;
  organizationId: string;
  survey: TPipelineSurvey;
  stripeCustomerId: string | null | undefined;
}) => {
  try {
    await recordResponseCreatedMeterEvent({
      stripeCustomerId,
      responseId: data.response.id,
      createdAt: data.response.createdAt,
    });
  } catch (error) {
    logger.error(
      {
        ...logContext,
        err: error,
      },
      "Response pipeline meter event failed"
    );
  }

  if (POSTHOG_KEY) {
    try {
      const responseCount = await getResponseCountBySurveyId(data.surveyId);
      captureSurveyResponsePostHogEvent({
        organizationId,
        surveyId: data.surveyId,
        surveyType: survey.type,
        workspaceId: data.workspaceId,
        responseCount,
      });
    } catch (error) {
      logger.error(
        {
          ...logContext,
          err: error,
        },
        "Response pipeline PostHog capture failed"
      );
    }
  }

  try {
    await sendTelemetryEvents();
  } catch (error) {
    logger.error(
      {
        ...logContext,
        err: error,
      },
      "Response pipeline telemetry dispatch failed"
    );
  }
};

export const processResponsePipelineJob: JobHandler<TResponsePipelineJobData> = async (data, context) => {
  const logContext = getPipelineLogContext(data, context);

  try {
    const [organization, survey, webhooks] = await Promise.all([
      getOrganizationForPipeline(data.workspaceId),
      getSurveyForPipeline(data.surveyId),
      getWebhooksForPipeline(data.workspaceId, data.event as PipelineTriggers, data.surveyId),
    ]);

    if (!survey) {
      throw new UnrecoverableError(`Survey ${data.surveyId} not found`);
    }

    if (!organization) {
      throw new UnrecoverableError(`Organization not found for workspace ${data.workspaceId}`);
    }

    if (survey.workspaceId !== data.workspaceId) {
      throw new UnrecoverableError(
        `Survey ${data.surveyId} does not belong to workspace ${data.workspaceId}`
      );
    }

    await deliverWebhooks({
      data,
      logContext,
      survey,
      webhooks,
    });

    if (data.event === "responseFinished") {
      await runResponseFinishedSideEffects({
        data,
        logContext,
        organizationId: organization.id,
        survey,
        workspaceId: data.workspaceId,
      });
    }

    if (data.event === "responseCreated") {
      await runResponseCreatedSideEffects({
        data,
        logContext,
        organizationId: organization.id,
        survey,
        stripeCustomerId: organization.billing?.stripeCustomerId,
      });
    }
  } catch (error) {
    if (isPipelinePoolExhaustionError(error)) {
      logger.warn(
        {
          ...logContext,
          err: error,
        },
        "Response pipeline job hit database pool exhaustion and will be retried"
      );
      throw error;
    }

    logger.error(
      {
        ...logContext,
        err: error,
      },
      "Response pipeline job failed"
    );
    throw error;
  }
};
