import { PipelineTriggers, Prisma, Webhook } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZWebhook } from "@formbricks/database/zod/webhooks";
import { logger } from "@formbricks/logger";
import { cache } from "@formbricks/redis";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZResponse } from "@formbricks/types/responses";
import { convertDatesInObject, transformIntegration } from "../utils";
import { getSurveyFollowUpsPermission } from "./survey-service";

export const ZPipelineInput = z.object({
  event: ZWebhook.shape.triggers.element,
  response: ZResponse,
  environmentId: z.string(),
  surveyId: z.string(),
});

export type TPipelineInput = z.infer<typeof ZPipelineInput>;

export const getOrganizationByEnvironmentId = async (environmentId: string) => {
  return cache(async () => {
    try {
      const organization = await prisma.organization.findFirst({
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
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          name: true,
          billing: true,
          isAIEnabled: true,
          whitelabel: true,
          memberships: true,
        },
      });

      return organization;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error getting organization by environment id");
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }, `getOrganizationByEnvironmentId-${environmentId}`)();
};

export const getSurvey = async (surveyId: string) => {
  return cache(async () => {
    let surveyPrisma;
    try {
      surveyPrisma = await prisma.survey.findUnique({
        where: {
          id: surveyId,
        },
        select: {
          id: true,
          name: true,
          questions: true,
          autoComplete: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error getting survey");
        throw new DatabaseError(error.message);
      }
      throw error;
    }

    if (!surveyPrisma) {
      return null;
    }

    return surveyPrisma;
  }, `getSurvey-${surveyId}`)();
};

const getIntegrations = async (environmentId: string) => {
  return cache(async () => {
    try {
      const integrations = await prisma.integration.findMany({
        where: { environmentId },
      });

      return integrations.map((integration) => transformIntegration(integration));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }, `getIntegrations-${environmentId}`)();
};

export const getResponseCountBySurveyId = async (surveyId: string): Promise<number> => {
  return cache(async () => {
    try {
      const survey = await getSurvey(surveyId);
      if (!survey) return 0;

      const responseCount = await prisma.response.count({
        where: { surveyId: survey.id },
      });

      return responseCount;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }, `getResponseCountBySurveyId-${surveyId}`)();
};

export const processPipeline = async (input: TPipelineInput) => {
  const convertedJsonInput = convertDatesInObject(input);

  const inputValidation = ZPipelineInput.safeParse(convertedJsonInput);

  if (!inputValidation.success) {
    logger.error({ error: inputValidation.error }, "Error in pipeline service");

    throw new Error("Error in pipeline service");
  }

  const { environmentId, surveyId, event, response } = inputValidation.data;

  const organization = await getOrganizationByEnvironmentId(environmentId);
  if (!organization) {
    throw new ResourceNotFoundError("Organization", "Organization not found");
  }

  // Fetch webhooks
  const getWebhooksForPipeline = cache(
    async (environmentId: string, event: PipelineTriggers, surveyId: string) => {
      const webhooks = await prisma.webhook.findMany({
        where: {
          environmentId,
          triggers: { has: event },
          OR: [{ surveyIds: { has: surveyId } }, { surveyIds: { isEmpty: true } }],
        },
      });
      return webhooks;
    },
    `getWebhooksForPipeline-${environmentId}-${event}-${surveyId}`
  );

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
      logger.error({ error }, `Webhook call to ${webhook.url} failed`);
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
      logger.error({ surveyId }, `Survey with id ${surveyId} not found`);
      throw new ResourceNotFoundError("Survey", "Survey not found");
    }

    if (integrations.length > 0) {
      // TODO: add integration service
    }

    // Fetch users with notifications in a single query
    // TODO: add cache for this query. Not possible at the moment since we can't get the membership cache by environmentId

    // send follow up emails
    const surveyFollowUpsPermission = await getSurveyFollowUpsPermission(organization.billing.plan);

    if (surveyFollowUpsPermission) {
      // TODO: add survey follow up service
    }

    // TODO: Send response finished email

    // Update survey status if necessary
    if (survey.autoComplete && responseCount >= survey.autoComplete) {
      // TODO: Update survey status
    }

    // Await webhook and email promises with allSettled to prevent early rejection
    const results = await Promise.allSettled([...webhookPromises]);
    results.forEach((result) => {
      if (result.status === "rejected") {
        logger.error({ error: result.reason }, "Promise rejected");
      }
    });

    // generate embeddings for all open text question responses for all paid plans
    const hasSurveyOpenTextQuestions = survey.questions.some((question) => question.type === "openText");
    if (hasSurveyOpenTextQuestions) {
      // TODO: add document and insight service
    }
  } else {
    // Await webhook promises if no emails are sent (with allSettled to prevent early rejection)
    const results = await Promise.allSettled(webhookPromises);
    results.forEach((result) => {
      if (result.status === "rejected") {
        logger.error({ error: result.reason }, "Promise rejected");
      }
    });
  }
};
