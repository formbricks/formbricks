import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { headers } from "next/headers";
import { prisma } from "@formbricks/database";
import { sendResponseFinishedEmail } from "@formbricks/email";
import { CRON_SECRET, IS_AI_ENABLED, IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { createDocument } from "@formbricks/lib/document/service";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey, updateSurvey } from "@formbricks/lib/survey/service";
import { convertDatesInObject } from "@formbricks/lib/time";
import { ZPipelineInput } from "@formbricks/types/pipelines";
import { TUserNotificationSettings } from "@formbricks/types/user";
import { handleIntegrations } from "./lib/handleIntegrations";

export const POST = async (request: Request) => {
  // check authentication with x-api-key header and CRON_SECRET env variable
  if (headers().get("x-api-key") !== CRON_SECRET) {
    return responses.notAuthenticatedResponse();
  }
  const jsonInput = await request.json();

  convertDatesInObject(jsonInput);

  const inputValidation = ZPipelineInput.safeParse(jsonInput);

  if (!inputValidation.success) {
    console.error(inputValidation.error);
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  const { environmentId, surveyId, event, response } = inputValidation.data;
  const product = await getProductByEnvironmentId(environmentId);
  if (!product) return;

  // get all webhooks of this environment where event in triggers
  const webhooks = await prisma.webhook.findMany({
    where: {
      environmentId,
      triggers: {
        has: event,
      },
      OR: [
        {
          surveyIds: {
            has: surveyId,
          },
        },
        {
          surveyIds: {
            isEmpty: true,
          },
        },
      ],
    },
  });

  // send request to all webhooks
  await Promise.all(
    webhooks.map(async (webhook) => {
      await fetch(webhook.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          webhookId: webhook.id,
          event,
          data: response,
        }),
      });
    })
  );

  if (event === "responseFinished") {
    // check for email notifications
    // get all users that have a membership of this environment's organization
    const users = await prisma.user.findMany({
      where: {
        memberships: {
          some: {
            organization: {
              products: {
                some: {
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
    });

    const [integrations, survey] = await Promise.all([getIntegrations(environmentId), getSurvey(surveyId)]);

    if (!survey) {
      console.error(`Pipeline: Survey with id ${surveyId} not found`);
      return new Response("Survey not found", {
        status: 404,
      });
    }

    if (integrations.length > 0 && survey) {
      await handleIntegrations(integrations, inputValidation.data, survey);
    }

    // filter all users that have email notifications enabled for this survey
    const usersWithNotifications = users.filter((user) => {
      const notificationSettings: TUserNotificationSettings | null = user.notificationSettings;
      if (notificationSettings?.alert && notificationSettings.alert[surveyId]) {
        return true;
      }
      return false;
    });

    // Exclude current response
    const responseCount = await getResponseCountBySurveyId(surveyId);

    if (usersWithNotifications.length > 0) {
      if (!survey) {
        console.error(`Pipeline: Survey with id ${surveyId} not found`);
        return new Response("Survey not found", {
          status: 404,
        });
      }
      // send email to all users
      await Promise.all(
        usersWithNotifications.map(async (user) => {
          await sendResponseFinishedEmail(user.email, environmentId, survey, response, responseCount);
        })
      );
    }
    const updateSurveyStatus = async (surveyId: string) => {
      // Get the survey instance by surveyId
      const survey = await getSurvey(surveyId);

      if (survey?.autoComplete) {
        // Get the number of responses to a survey
        const responseCount = await prisma.response.count({
          where: {
            surveyId: surveyId,
          },
        });
        if (responseCount === survey.autoComplete) {
          const updatedSurvey = { ...survey };
          updatedSurvey.status = "completed";
          await updateSurvey(updatedSurvey);
        }
      }
    };

    await updateSurveyStatus(surveyId);

    // generate embeddings for all open text question responses for all paid plans
    // TODO: check longer surveys if documents get created multiple times
    const hasSurveyOpenTextQuestions = survey.questions.some((question) => question.type === "openText");
    if (hasSurveyOpenTextQuestions && IS_FORMBRICKS_CLOUD) {
      // const { active: isEnterpriseEdition } = await getEnterpriseLicense();
      const isAiEnabled = IS_AI_ENABLED;
      if (hasSurveyOpenTextQuestions && isAiEnabled) {
        const organization = await getOrganizationByEnvironmentId(environmentId);
        if (!organization) {
          throw new Error("Organization not found");
        }
        if (
          organization.billing.plan === "enterprise" ||
          organization.billing.plan === "scale" ||
          organization.billing.plan === "startup"
        ) {
          for (const question of survey.questions) {
            if (question.type === "openText") {
              const isQuestionAnswered = response.data[question.id] !== undefined;
              if (!isQuestionAnswered) {
                continue;
              }
              const text = `**${question.headline.default}**\n${response.data[question.id]}`;
              // TODO: check if subheadline gives more context and better embeddings
              await createDocument({
                environmentId,
                surveyId,
                responseId: response.id,
                questionId: question.id,
                text,
              });
            }
          }
        }
      }
    }
  }

  return Response.json({ data: {} });
};
