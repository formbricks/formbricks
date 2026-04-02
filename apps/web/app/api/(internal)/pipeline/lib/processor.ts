import { PipelineTriggers, Prisma, Webhook } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { sendTelemetryEvents } from "@/app/api/(internal)/pipeline/lib/telemetry";
import { TPipelineInput, TPipelineJob } from "@/app/lib/types/pipelines";
import { generateStandardWebhookSignature } from "@/lib/crypto";
import { getIntegrations } from "@/lib/integration/service";
import { validateWebhookUrl } from "@/lib/utils/validate-webhook-url";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { TAuditStatus, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { recordResponseCreatedMeterEvent } from "@/modules/ee/billing/lib/metering";
import { sendResponseFinishedEmail } from "@/modules/email";
import { resolveStorageUrlsInObject } from "@/modules/storage/utils";
import { sendFollowUpsForResponse } from "@/modules/survey/follow-ups/lib/follow-ups";
import { FollowUpSendError } from "@/modules/survey/follow-ups/types/follow-up";
import { handleIntegrations } from "./handleIntegrations";

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
  environmentId: true,
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
          projectId: true,
        },
      },
    },
  },
} satisfies Prisma.SurveySelect;

type TPipelineOrganization = Prisma.OrganizationGetPayload<{ select: typeof pipelineOrganizationSelect }>;
type TPipelineSurvey = Prisma.SurveyGetPayload<{ select: typeof pipelineSurveySelect }>;

const getOrganizationForPipeline = async (environmentId: string): Promise<TPipelineOrganization | null> =>
  prisma.organization.findFirst({
    where: {
      projects: {
        some: {
          environments: {
            some: {
              id: environmentId,
            },
          },
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

const getWebhooksForPipeline = async (
  environmentId: string,
  event: PipelineTriggers,
  surveyId: string
): Promise<Webhook[]> =>
  prisma.webhook.findMany({
    where: {
      environmentId,
      triggers: { has: event },
      OR: [{ surveyIds: { has: surveyId } }, { surveyIds: { isEmpty: true } }],
    },
  });

const getResponseCountForPipeline = async (surveyId: string): Promise<number> =>
  prisma.response.count({
    where: {
      surveyId,
    },
  });

const getUsersWithNotifications = async (environmentId: string, surveyId: string) =>
  prisma.user.findMany({
    where: {
      memberships: {
        some: {
          organization: {
            projects: {
              some: {
                environments: {
                  some: { id: environmentId },
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
                projectTeams: {
                  some: {
                    project: {
                      environments: {
                        some: {
                          id: environmentId,
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
        path: ["alert", surveyId],
        equals: true,
      },
    },
    select: { email: true, locale: true },
  });

const fetchWithTimeout = (url: string, options: RequestInit, timeoutMs: number = 5000): Promise<Response> =>
  Promise.race([
    fetch(url, options),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs)),
  ]);

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

const createWebhookPromises = (
  webhooks: Webhook[],
  event: PipelineTriggers,
  response: TPipelineInput["response"],
  survey: TPipelineSurvey
) => {
  const resolvedResponseData = resolveStorageUrlsInObject(response.data);

  return webhooks.map((webhook) => {
    const body = JSON.stringify({
      webhookId: webhook.id,
      event,
      data: {
        ...response,
        data: resolvedResponseData,
        survey: {
          title: survey.name,
          type: survey.type,
          status: survey.status,
          createdAt: survey.createdAt,
          updatedAt: survey.updatedAt,
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

    return validateWebhookUrl(webhook.url)
      .then(() =>
        fetchWithTimeout(webhook.url, {
          method: "POST",
          headers: requestHeaders,
          body,
        })
      )
      .catch((error) => {
        logger.error({ error, webhookId: webhook.id, url: webhook.url }, "Webhook call failed");
      });
  });
};

const logRejectedPromises = (results: PromiseSettledResult<unknown>[]) => {
  results.forEach((result) => {
    if (result.status === "rejected") {
      logger.error({ error: result.reason }, "Promise rejected during pipeline processing");
    }
  });
};

const handleResponseFinishedJob = async (
  job: TPipelineInput,
  organization: TPipelineOrganization,
  survey: TPipelineSurvey,
  webhookPromises: Promise<unknown>[]
): Promise<void> => {
  const [integrations, responseCount, usersWithNotifications] = await Promise.all([
    getIntegrations(job.environmentId),
    getResponseCountForPipeline(job.surveyId),
    getUsersWithNotifications(job.environmentId, job.surveyId),
  ]);

  if (integrations.length > 0) {
    await handleIntegrations(integrations, job, survey as unknown as TSurvey);
  }

  if (survey.followUps?.length > 0) {
    const followUpsResult = await sendFollowUpsForResponse(job.response.id);
    if (!followUpsResult.ok) {
      const { error: followUpsError } = followUpsResult;
      if (followUpsError.code !== FollowUpSendError.FOLLOW_UP_NOT_ALLOWED) {
        logger.error({ error: followUpsError }, `Failed to send follow-up emails for survey ${job.surveyId}`);
      }
    }
  }

  const emailPromises = usersWithNotifications.map((user) =>
    sendResponseFinishedEmail(
      user.email,
      user.locale,
      job.environmentId,
      survey as unknown as TSurvey,
      job.response,
      responseCount
    ).catch((error) => {
      logger.error(
        { error, userEmail: user.email },
        `Failed to send response finished email to ${user.email}`
      );
    })
  );

  if (survey.autoComplete && responseCount >= survey.autoComplete) {
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
        { error, surveyId: survey.id },
        `Failed to update survey ${survey.id} status to completed`
      );
    } finally {
      await queueAuditEvent({
        status: logStatus,
        action: "updated",
        targetType: "survey",
        userId: UNKNOWN_DATA,
        userType: "system",
        targetId: survey.id,
        organizationId: organization.id,
        newObject: {
          status: "completed",
        },
      }).catch((error) => {
        logger.error({ error, surveyId: survey.id }, "Failed to queue auto-complete audit event");
      });
    }
  }

  logRejectedPromises(await Promise.allSettled([...webhookPromises, ...emailPromises]));
};

export const processPipelineJob = async (job: TPipelineInput | TPipelineJob): Promise<void> => {
  const { environmentId, surveyId, event, response } = job;

  try {
    const [organization, survey, webhooks] = await Promise.all([
      getOrganizationForPipeline(environmentId),
      getSurveyForPipeline(surveyId),
      getWebhooksForPipeline(environmentId, event, surveyId),
    ]);

    if (!organization) {
      throw new ResourceNotFoundError("Organization", "Organization not found");
    }

    if (!survey) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    if (survey.environmentId !== environmentId) {
      throw new Error(`Survey ${surveyId} does not belong to environment ${environmentId}`);
    }

    const webhookPromises = createWebhookPromises(webhooks, event, response, survey);

    if (event === "responseFinished") {
      await handleResponseFinishedJob(
        { environmentId, surveyId, event, response },
        organization,
        survey,
        webhookPromises
      );
    } else {
      logRejectedPromises(await Promise.allSettled(webhookPromises));
    }

    if (event === "responseCreated") {
      recordResponseCreatedMeterEvent({
        stripeCustomerId: organization.billing?.stripeCustomerId ?? null,
        responseId: response.id,
        createdAt: response.createdAt,
      }).catch((error) => {
        logger.error({ error, responseId: response.id }, "Failed to record response meter event");
      });

      await sendTelemetryEvents().catch((error) => {
        logger.error({ error, responseId: response.id }, "Failed to send pipeline telemetry events");
      });
    }
  } catch (error) {
    if (isPipelinePoolExhaustionError(error)) {
      logger.warn(
        {
          error,
          event,
          surveyId,
          environmentId,
          responseId: response.id,
          jobId: "jobId" in job ? job.jobId : undefined,
          attempt: "attempt" in job ? job.attempt : undefined,
        },
        "Pipeline job hit database pool exhaustion and will be retried"
      );
    }

    throw error;
  }
};
