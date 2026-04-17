import "server-only";
import { PipelineTriggers, type Webhook } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@formbricks/database";
import type { JobHandler, TResponsePipelineJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { type TUserLocale, ZUserLocale } from "@formbricks/types/user";
import { generateStandardWebhookSignature } from "@/lib/crypto";
import { getIntegrations } from "@/lib/integration/service";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey, updateSurvey } from "@/lib/survey/service";
import { validateWebhookUrl } from "@/lib/utils/validate-webhook-url";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { type TAuditStatus, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { recordResponseCreatedMeterEvent } from "@/modules/ee/billing/lib/metering";
import { sendResponseFinishedEmail } from "@/modules/email";
import { resolveStorageUrlsInObject } from "@/modules/storage/utils";
import { sendFollowUpsForResponse } from "@/modules/survey/follow-ups/lib/follow-ups";
import { FollowUpSendError } from "@/modules/survey/follow-ups/types/follow-up";
import { handleIntegrations } from "./handle-integrations";
import { sendTelemetryEvents } from "./telemetry";

const WEBHOOK_TIMEOUT_MS = 5_000;
const DEFAULT_NOTIFICATION_LOCALE: TUserLocale = "en-US";

const getPipelineLogContext = (
  data: TResponsePipelineJobData,
  context: Parameters<JobHandler<TResponsePipelineJobData>>[1]
) => ({
  attempt: context.attempt,
  environmentId: data.environmentId,
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

const createWebhookMessageId = ({
  event,
  jobId,
  webhookId,
}: {
  event: TResponsePipelineJobData["event"];
  jobId: string;
  webhookId: string;
}): string => createHash("sha256").update(`${jobId}:${webhookId}:${event}`).digest("hex");

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
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
    });
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
  survey: Awaited<ReturnType<typeof getSurvey>>;
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

    await validateWebhookUrl(webhook.url);
    const response = await fetchWithTimeout(webhook.url, {
      method: "POST",
      headers: requestHeaders,
      body,
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed with status ${response.status}`);
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
  survey: NonNullable<Awaited<ReturnType<typeof getSurvey>>>;
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
              every: {
                role: {
                  in: ["owner", "manager"],
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
  survey: NonNullable<Awaited<ReturnType<typeof getSurvey>>>;
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
  survey: NonNullable<Awaited<ReturnType<typeof getSurvey>>>;
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
  survey: NonNullable<Awaited<ReturnType<typeof getSurvey>>>;
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
    await updateSurvey({
      ...survey,
      status: "completed",
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
      newObject: {
        status: "completed",
      },
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
  survey: NonNullable<Awaited<ReturnType<typeof getSurvey>>>;
  workspaceId: string;
}) => {
  const { integrations, responseCount } = await loadResponseFinishedContext({
    data,
    logContext,
    workspaceId,
  });

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

  const usersWithNotifications = await getUsersWithNotifications({
    data,
    logContext,
    workspaceId,
  });

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
  stripeCustomerId,
}: {
  data: TResponsePipelineJobData;
  logContext: ReturnType<typeof getPipelineLogContext>;
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
    const survey = await getSurvey(data.surveyId);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", data.surveyId);
    }

    const organization = await getOrganizationByWorkspaceId(survey.workspaceId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", "Organization not found");
    }

    const event = data.event as PipelineTriggers;
    const workspaceId = survey.workspaceId;
    const webhooks = await getWebhooksForPipeline(workspaceId, event, data.surveyId);
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
        workspaceId,
      });
    }

    if (data.event === "responseCreated") {
      await runResponseCreatedSideEffects({
        data,
        logContext,
        stripeCustomerId: organization.billing.stripeCustomerId,
      });
    }
  } catch (error) {
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
