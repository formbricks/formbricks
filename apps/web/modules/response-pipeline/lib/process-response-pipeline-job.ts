import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@formbricks/database";
import { PipelineTriggers, Prisma } from "@formbricks/database/prisma";
import {
  type JobHandler,
  type TResponsePipelineJobData,
  UnrecoverableError,
  enqueueWebhookDeliveryJob,
} from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { type TUserLocale, ZUserLocale } from "@formbricks/types/user";
import { POSTHOG_KEY } from "@/lib/constants";
import { handleFeedbackSourcePipeline } from "@/lib/feedback-source/pipeline-handler";
import { getIntegrations } from "@/lib/integration/service";
import { isDatabasePoolExhaustionError } from "@/lib/jobs/pool-exhaustion";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { type TAuditStatus, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { recordResponseCreatedMeterEvent } from "@/modules/ee/billing/lib/metering";
import { dispatchWorkflowRunViaJobs } from "@/modules/ee/workflows/lib/runner/dispatch";
import { enqueueResponseCompletedWorkflowRuns } from "@/modules/ee/workflows/lib/runner/enqueue-response-completed-runs";
import { sendResponseFinishedEmail } from "@/modules/email";
import { captureSurveyResponsePostHogEvent } from "@/modules/response-pipeline/lib/posthog";
import { sendFollowUpsForResponse } from "@/modules/survey/follow-ups/lib/follow-ups";
import { FollowUpSendError } from "@/modules/survey/follow-ups/types/follow-up";
import { getFinishedResponseCountBySurveyId } from "@/modules/survey/lib/response";
import { handleIntegrations } from "./handle-integrations";
import { sendTelemetryEvents } from "./telemetry";

const DEFAULT_NOTIFICATION_LOCALE: TUserLocale = "en-US";

const pipelineOrganizationSelect = {
  id: true,
  displayTimeZone: true,
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

/**
 * The Standard Webhooks `webhook-id`, derived from this pipeline job's id. Unchanged from when this job
 * delivered webhooks itself, so receivers see the same ids — and because it is fixed here and carried
 * into the delivery job, it stays constant across every retry of either job.
 */
const createWebhookMessageId = ({
  event,
  jobId,
  webhookId,
}: {
  event: TResponsePipelineJobData["event"];
  jobId: string;
  webhookId: string;
}): string => createHash("sha256").update(`${jobId}:${webhookId}:${event}`).digest("hex");

/**
 * Deterministic per (pipeline job, webhook): BullMQ ignores an `add` whose jobId already exists, so a
 * pipeline retry after a partial fan-out re-enqueues only the deliveries that never made it. Keyed on the
 * pipeline job id rather than the response, because `responseUpdated` legitimately fires once per update
 * and each must be delivered.
 */
const createWebhookDeliveryJobId = (jobId: string, webhookId: string): string => `whd-${jobId}-${webhookId}`;

type TPipelineWebhook = { id: string };

// Ids only: the delivery job re-reads url and secret at send time, so the secret never enters Redis.
const getWebhooksForPipeline = async (
  workspaceId: string,
  event: PipelineTriggers,
  surveyId: string
): Promise<TPipelineWebhook[]> => {
  return await prisma.webhook.findMany({
    where: {
      workspaceId,
      triggers: { has: event },
      OR: [{ surveyIds: { has: surveyId } }, { surveyIds: { isEmpty: true } }],
    },
    select: { id: true },
  });
};

/**
 * Fans the event out as one `webhook-delivery.process` job per matching webhook and returns without
 * waiting on any HTTP. Each delivery then retries on its own budget, so a dead endpoint neither delays
 * the side effects below nor causes the healthy endpoints to be re-sent.
 *
 * Enqueue failures (Redis unavailable) fail this job while attempts remain — the deterministic child
 * ids make the retry idempotent — and on the final attempt are logged and skipped so the remaining
 * side effects still run, as before.
 */
const enqueueWebhookDeliveryJobs = async ({
  data,
  logContext,
  survey,
  webhooks,
}: {
  data: TResponsePipelineJobData;
  logContext: ReturnType<typeof getPipelineLogContext>;
  survey: TPipelineSurvey;
  webhooks: TPipelineWebhook[];
}): Promise<void> => {
  if (webhooks.length === 0) {
    return;
  }

  const results = await Promise.allSettled(
    webhooks.map((webhook) =>
      enqueueWebhookDeliveryJob(
        {
          webhookId: webhook.id,
          workspaceId: data.workspaceId,
          surveyId: data.surveyId,
          event: data.event,
          webhookMessageId: createWebhookMessageId({
            event: data.event,
            jobId: logContext.jobId,
            webhookId: webhook.id,
          }),
          response: data.response,
          survey: {
            name: survey.name,
            type: survey.type,
            status: survey.status,
            createdAt: survey.createdAt,
            updatedAt: survey.updatedAt,
          },
        },
        { jobId: createWebhookDeliveryJobId(logContext.jobId, webhook.id) }
      )
    )
  );

  const failedResults = results.filter((result) => result.status === "rejected");
  if (failedResults.length === 0) {
    logger.debug(
      { ...logContext, webhookCount: webhooks.length },
      "Response pipeline webhook deliveries enqueued"
    );
    return;
  }

  if (logContext.attempt < logContext.maxAttempts) {
    throw toError(failedResults[0].reason, "Response pipeline webhook delivery enqueue failed");
  }

  logger.error(
    {
      ...logContext,
      failedWebhookCount: failedResults.length,
    },
    "Response pipeline webhook delivery enqueue exhausted retries; continuing with remaining side effects"
  );
};

const loadIntegrationsSafely = async ({
  logContext,
  workspaceId,
}: {
  logContext: ReturnType<typeof getPipelineLogContext>;
  workspaceId: string;
}): Promise<Awaited<ReturnType<typeof getIntegrations>>> => {
  try {
    return await getIntegrations(workspaceId);
  } catch (error) {
    logger.error(
      {
        ...logContext,
        err: error,
      },
      "Response pipeline integration lookup failed"
    );

    return [];
  }
};

/**
 * Response counts are optional side inputs: a failed lookup must never fail the job, so it
 * resolves to `null` and the consumer skips its own work instead.
 */
const loadResponseCountSafely = async ({
  count,
  failureMessage,
  logContext,
}: {
  count: () => Promise<number>;
  failureMessage: string;
  logContext: Record<string, unknown>;
}): Promise<number | null> => {
  try {
    return await count();
  } catch (error) {
    logger.error(
      {
        ...logContext,
        err: error,
      },
      failureMessage
    );

    return null;
  }
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
    const followUpsResult = await sendFollowUpsForResponse(data.response.id, data.locale);
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

/**
 * The completed-response count that closes this survey, or `null` when the response limit
 * cannot apply — no limit configured, or the survey is already closed.
 *
 * The limit is defined in terms of *completed* responses, so only finished responses count
 * towards it. Counting every response would close the survey once the number of starts
 * (partial + finished) hit the limit.
 */
const getAutoCompleteThreshold = (survey: TPipelineSurvey): number | null =>
  survey.autoComplete && survey.status !== "completed" ? survey.autoComplete : null;

const handleSurveyAutoCompleteSafely = async ({
  finishedResponseCount,
  logContext,
  organizationId,
  survey,
}: {
  finishedResponseCount: number | null;
  logContext: ReturnType<typeof getPipelineLogContext>;
  organizationId: string;
  survey: TPipelineSurvey;
}): Promise<void> => {
  const autoCompleteThreshold = getAutoCompleteThreshold(survey);

  // `finishedResponseCount` is only looked up when a threshold applies, so a `null` here means
  // the lookup failed — already logged by loadResponseCountSafely.
  if (autoCompleteThreshold === null || finishedResponseCount === null) {
    return;
  }

  if (finishedResponseCount < autoCompleteThreshold) {
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
  displayTimeZone,
  logContext,
  organizationId,
  stripeCustomerId,
  survey,
  workspaceId,
}: {
  data: TResponsePipelineJobData;
  displayTimeZone: string | null;
  logContext: ReturnType<typeof getPipelineLogContext>;
  organizationId: string;
  stripeCustomerId: string | null | undefined;
  survey: TPipelineSurvey;
  workspaceId: string;
}) => {
  const [integrations, usersWithNotifications] = await Promise.all([
    loadIntegrationsSafely({
      logContext,
      workspaceId,
    }),
    getUsersWithNotifications({
      data,
      logContext,
      workspaceId,
    }),
  ]);

  // Neither count is consumed until the notification/auto-complete steps at the end, so start
  // them here to overlap with the integration and follow-up work below. Each is skipped
  // entirely when nothing would consume it, keeping this off the hot path for the common case.
  const autoCompleteThreshold = getAutoCompleteThreshold(survey);

  const responseCountPromise =
    usersWithNotifications.length > 0
      ? loadResponseCountSafely({
          count: () => getResponseCountBySurveyId(data.surveyId),
          failureMessage: "Response pipeline response count lookup failed",
          logContext,
        })
      : Promise.resolve(null);

  const finishedResponseCountPromise =
    autoCompleteThreshold !== null
      ? loadResponseCountSafely({
          count: () => getFinishedResponseCountBySurveyId(survey.id),
          failureMessage:
            "Response pipeline survey auto-complete skipped because the finished response count could not be loaded",
          logContext: { ...logContext, autoCompleteThreshold },
        })
      : Promise.resolve(null);

  if (integrations.length > 0) {
    try {
      await handleIntegrations(integrations, data, survey, displayTimeZone ?? "UTC");
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
    responseCount: await responseCountPromise,
    survey,
    usersWithNotifications,
    workspaceId,
  });

  await handleSurveyAutoCompleteSafely({
    finishedResponseCount: await finishedResponseCountPromise,
    logContext,
    organizationId,
    survey,
  });

  // Workflow runner (producer): enqueue runs for matching enabled workflows. Isolated so a runner
  // failure never breaks the response pipeline job, its retries, or the other side-effects above.
  try {
    await enqueueResponseCompletedWorkflowRuns({
      response: data.response,
      workspaceId,
      organizationId,
      stripeCustomerId,
      dispatch: dispatchWorkflowRunViaJobs,
      logContext,
    });
  } catch (error) {
    // Transient DB pool exhaustion must propagate so the job retries (same contract as the outer
    // pipeline catch); otherwise a completed-response trigger is silently lost. Only non-retryable
    // failures are swallowed, so they never break the other responseFinished side-effects above.
    if (isDatabasePoolExhaustionError(error)) {
      throw error;
    }
    logger.error({ ...logContext, err: error }, "Response pipeline workflow run enqueue failed");
  }
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

    await enqueueWebhookDeliveryJobs({
      data,
      logContext,
      survey,
      webhooks,
    });

    if (data.event === "responseFinished") {
      await runResponseFinishedSideEffects({
        data,
        displayTimeZone: organization.displayTimeZone,
        logContext,
        organizationId: organization.id,
        stripeCustomerId: organization.billing?.stripeCustomerId,
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
    if (isDatabasePoolExhaustionError(error)) {
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
