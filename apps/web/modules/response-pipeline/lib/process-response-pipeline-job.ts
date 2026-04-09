import "server-only";
import { PipelineTriggers, type Webhook } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import { prisma } from "@formbricks/database";
import type { JobHandler, TResponsePipelineJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { generateStandardWebhookSignature } from "@/lib/crypto";
import { getIntegrations } from "@/lib/integration/service";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
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

const getPipelineLogContext = (
  data: TResponsePipelineJobData,
  context: Parameters<JobHandler<TResponsePipelineJobData>>[1]
) => ({
  attempt: context.attempt,
  environmentId: data.environmentId,
  event: data.event,
  jobId: context.jobId,
  jobName: context.jobName,
  queueName: context.queueName,
  responseId: data.response.id,
  surveyId: data.surveyId,
});

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
  environmentId: string,
  event: PipelineTriggers,
  surveyId: string
): Promise<Webhook[]> => {
  return await prisma.webhook.findMany({
    where: {
      environmentId,
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

    const webhookMessageId = uuidv7();
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

const runResponseFinishedSideEffects = async ({
  data,
  logContext,
  organizationId,
  survey,
}: {
  data: TResponsePipelineJobData;
  logContext: ReturnType<typeof getPipelineLogContext>;
  organizationId: string;
  survey: NonNullable<Awaited<ReturnType<typeof getSurvey>>>;
}) => {
  const [integrations, responseCount] = await Promise.all([
    getIntegrations(data.environmentId),
    getResponseCountBySurveyId(data.surveyId),
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

  const usersWithNotifications = await prisma.user.findMany({
    where: {
      memberships: {
        some: {
          organization: {
            workspaces: {
              some: {
                environments: {
                  some: { id: data.environmentId },
                },
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
                      environments: {
                        some: {
                          id: data.environmentId,
                        },
                      },
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

  if (survey.followUps?.length > 0) {
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
  }

  const emailTasks = usersWithNotifications.map(async (user) => {
    try {
      await sendResponseFinishedEmail(
        user.email,
        user.locale,
        data.environmentId,
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
      throw error;
    }
  });

  if (survey.autoComplete && responseCount >= survey.autoComplete) {
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
    } finally {
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
    }
  }

  await Promise.allSettled(emailTasks);
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
  recordResponseCreatedMeterEvent({
    stripeCustomerId,
    responseId: data.response.id,
    createdAt: data.response.createdAt,
  }).catch((error) => {
    logger.error(
      {
        ...logContext,
        err: error,
      },
      "Response pipeline meter event failed"
    );
  });

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
    const organization = await getOrganizationByEnvironmentId(data.environmentId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", "Organization not found");
    }

    const survey = await getSurvey(data.surveyId);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", data.surveyId);
    }

    if (survey.environmentId !== data.environmentId) {
      throw new Error(`Survey ${data.surveyId} does not belong to environment ${data.environmentId}`);
    }

    const event = data.event as PipelineTriggers;
    const webhooks = await getWebhooksForPipeline(data.environmentId, event, data.surveyId);
    const webhookTasks = webhooks.map((webhook) =>
      createWebhookDeliveryTask({
        webhook,
        data,
        survey,
        logContext,
      })
    );

    if (data.event === "responseFinished") {
      await Promise.all([
        Promise.allSettled(webhookTasks),
        runResponseFinishedSideEffects({
          data,
          logContext,
          organizationId: organization.id,
          survey,
        }),
      ]);
    } else {
      await Promise.allSettled(webhookTasks);
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
