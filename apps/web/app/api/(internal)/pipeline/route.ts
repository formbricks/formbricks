import { ZPipelineInput } from "@/app/api/(internal)/pipeline/types/pipelines";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { CRON_SECRET } from "@/lib/constants";
import { getIntegrations } from "@/lib/integration/service";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey, updateSurvey } from "@/lib/survey/service";
import { convertDatesInObject } from "@/lib/time";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { TAuditStatus, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { sendResponseFinishedEmail } from "@/modules/email";
import { sendFollowUpsForResponse } from "@/modules/survey/follow-ups/lib/follow-ups";
import { FollowUpSendError } from "@/modules/survey/follow-ups/types/follow-up";
import { PipelineTriggers, Webhook } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { handleIntegrations } from "./lib/handleIntegrations";

export const POST = async (request: Request) => {
  const requestHeaders = await headers();
  // Check authentication
  if (requestHeaders.get("x-api-key") !== CRON_SECRET) {
    return responses.notAuthenticatedResponse();
  }

  const jsonInput = await request.json();
  const convertedJsonInput = convertDatesInObject(jsonInput);

  const inputValidation = ZPipelineInput.safeParse(convertedJsonInput);

  if (!inputValidation.success) {
    logger.error(
      { error: inputValidation.error, url: request.url },
      "Error in POST /api/(internal)/pipeline"
    );
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  const { environmentId, surveyId, event, response } = inputValidation.data;

  const organization = await getOrganizationByEnvironmentId(environmentId);
  if (!organization) {
    throw new ResourceNotFoundError("Organization", "Organization not found");
  }

  // Fetch webhooks
  const getWebhooksForPipeline = async (environmentId: string, event: PipelineTriggers, surveyId: string) => {
    const webhooks = await prisma.webhook.findMany({
      where: {
        environmentId,
        triggers: { has: event },
        OR: [{ surveyIds: { has: surveyId } }, { surveyIds: { isEmpty: true } }],
      },
    });
    return webhooks;
  };

  const webhooks: Webhook[] = await getWebhooksForPipeline(environmentId, event, surveyId);
  // Prepare webhook and email promises

  // Fetch with timeout of 5 seconds to prevent hanging
  const fetchWithTimeout = (url: string, options: RequestInit, timeout: number = 5000): Promise<Response> => {
    return Promise.race([
      fetch(url, options),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeout)),
    ]);
  };

  const webhookPromises = webhooks.map((webhook) =>
    fetchWithTimeout(webhook.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        webhookId: webhook.id,
        event,
        data: response,
      }),
    }).catch((error) => {
      logger.error({ error, url: request.url }, `Webhook call to ${webhook.url} failed`);
    })
  );

  if (event === "responseFinished") {
    // Fetch integrations, survey, and responseCount in parallel
    const [integrations, survey, responseCount] = await Promise.all([
      getIntegrations(environmentId),
      getSurvey(surveyId),
      getResponseCountBySurveyId(surveyId),
    ]);

    if (!survey) {
      logger.error({ url: request.url, surveyId }, `Survey with id ${surveyId} not found`);
      return new Response("Survey not found", { status: 404 });
    }

    if (integrations.length > 0) {
      await handleIntegrations(integrations, inputValidation.data, survey);
    }

    // Fetch users with notifications in a single query
    // TODO: add cache for this query. Not possible at the moment since we can't get the membership cache by environmentId
    const usersWithNotifications = await prisma.user.findMany({
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

    if (survey.followUps?.length > 0) {
      // send follow up emails
      const followUpsResult = await sendFollowUpsForResponse(response.id);
      if (!followUpsResult.ok) {
        const { error: followUpsError } = followUpsResult;
        if (followUpsError.code !== FollowUpSendError.FOLLOW_UP_NOT_ALLOWED) {
          logger.error({ error: followUpsError }, `Failed to send follow-up emails for survey ${surveyId}`);
        }
      }
    }

    const emailPromises = usersWithNotifications.map((user) =>
      sendResponseFinishedEmail(user.email, environmentId, survey, response, responseCount).catch((error) => {
        logger.error(
          { error, url: request.url, userEmail: user.email },
          `Failed to send email to ${user.email}`
        );
      })
    );

    // Update survey status if necessary
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
          { error, url: request.url, surveyId },
          `Failed to update survey ${surveyId} status to completed`
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
        });
      }
    }

    // Await webhook and email promises with allSettled to prevent early rejection
    const results = await Promise.allSettled([...webhookPromises, ...emailPromises]);
    results.forEach((result) => {
      if (result.status === "rejected") {
        logger.error({ error: result.reason, url: request.url }, "Promise rejected");
      }
    });
  } else {
    // Await webhook promises if no emails are sent (with allSettled to prevent early rejection)
    const results = await Promise.allSettled(webhookPromises);
    results.forEach((result) => {
      if (result.status === "rejected") {
        logger.error({ error: result.reason, url: request.url }, "Promise rejected");
      }
    });
  }

  return Response.json({ data: {} });
};
