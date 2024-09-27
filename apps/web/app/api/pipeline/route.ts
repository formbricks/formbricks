import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@formbricks/database";
import { sendResponseFinishedEmail } from "@formbricks/email";
import { CRON_SECRET } from "@formbricks/lib/constants";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey, updateSurvey } from "@formbricks/lib/survey/service";
import { convertDatesInObject } from "@formbricks/lib/time";
import { ZPipelineInput } from "@formbricks/types/pipelines";
import { handleIntegrations } from "./lib/handleIntegrations";

export const POST = async (request: Request) => {
  // Check authentication
  if (headers().get("x-api-key") !== CRON_SECRET) {
    return responses.notAuthenticatedResponse();
  }

  const jsonInput = await request.json();
  const convertedJsonInput = convertDatesInObject(jsonInput);

  const inputValidation = ZPipelineInput.safeParse(convertedJsonInput);

  if (!inputValidation.success) {
    console.error(inputValidation.error);
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  const { environmentId, surveyId, event, response } = inputValidation.data;

  // Fetch webhooks
  const webhooks = await prisma.webhook.findMany({
    where: {
      environmentId,
      triggers: { has: event },
      OR: [{ surveyIds: { has: surveyId } }, { surveyIds: { isEmpty: true } }],
    },
  });

  // Prepare webhook and email promises

  // Fetch with timeout of 5 seconds to prevent hanging
  const fetchWithTimeout = (url, options, timeout = 5000) => {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeout)),
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
    })
  );

  if (event === "responseFinished") {
    // Fetch integrations, survey, and responseCount in parallel
    const [integrations, surveyData, responseCount] = await Promise.all([
      getIntegrations(environmentId),
      getSurvey(surveyId),
      getResponseCountBySurveyId(surveyId),
    ]);
    const survey = surveyData ?? undefined;

    if (!survey) {
      console.error(`Survey with id ${surveyId} not found`);
      return new Response("Survey not found", { status: 404 });
    }

    if (integrations.length > 0) {
      await handleIntegrations(integrations, inputValidation.data, survey);
    }

    // Fetch users with notifications in a single query
    const usersWithNotifications = await prisma.user.findMany({
      where: {
        memberships: {
          some: {
            organization: {
              products: {
                some: {
                  environments: {
                    some: { id: environmentId },
                  },
                },
              },
            },
          },
        },
        notificationSettings: {
          path: ["alert", surveyId],
          not: Prisma.JsonNull,
        },
      },
      select: { email: true },
    });

    const emailPromises = usersWithNotifications.map((user) =>
      sendResponseFinishedEmail(user.email, environmentId, survey, response, responseCount)
    );

    // Update survey status if necessary
    if (survey.autoComplete && responseCount === survey.autoComplete) {
      survey.status = "completed";
      await updateSurvey(survey);
    }

    // Await all promises
    await Promise.all([...webhookPromises, ...emailPromises]);
  } else {
    // Await webhook promises if no emails are sent
    await Promise.all(webhookPromises);
  }

  return Response.json({ data: {} });
};
