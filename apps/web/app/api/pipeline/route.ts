import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@formbricks/database";
import { INTERNAL_SECRET } from "@formbricks/lib/constants";
import { sendResponseFinishedEmail } from "@formbricks/lib/emails/emails";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey, updateSurvey } from "@formbricks/lib/survey/service";
import { convertDatesInObject } from "@formbricks/lib/time";
import { ZPipelineInput } from "@formbricks/types/pipelines";
import { TSurveyQuestion } from "@formbricks/types/surveys";
import { TUserNotificationSettings } from "@formbricks/types/user";

import { handleIntegrations } from "./lib/handleIntegrations";

export async function POST(request: Request) {
  // check authentication with x-api-key header and CRON_SECRET env variable
  if (headers().get("x-api-key") !== INTERNAL_SECRET) {
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
    // get all users that have a membership of this environment's team
    const users = await prisma.user.findMany({
      where: {
        memberships: {
          some: {
            team: {
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

    let surveyData;

    const integrations = await getIntegrations(environmentId);

    if (integrations.length > 0) {
      surveyData = await prisma.survey.findUnique({
        where: {
          id: surveyId,
        },
        select: {
          id: true,
          name: true,
          questions: true,
        },
      });
      handleIntegrations(integrations, inputValidation.data, surveyData);
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
    const numberOfExistingResponses = (await getResponseCountBySurveyId(surveyId)) - 1;

    if (usersWithNotifications.length > 0) {
      // get survey
      if (!surveyData) {
        surveyData = await prisma.survey.findUnique({
          where: {
            id: surveyId,
          },
          select: {
            id: true,
            name: true,
            questions: true,
          },
        });
      }

      if (!surveyData) {
        console.error(`Pipeline: Survey with id ${surveyId} not found`);
        return new Response("Survey not found", {
          status: 404,
        });
      }
      // create survey object
      const survey = {
        id: surveyData.id,
        name: surveyData.name,
        questions: JSON.parse(JSON.stringify(surveyData.questions)) as TSurveyQuestion[],
      };
      // send email to all users
      await Promise.all(
        usersWithNotifications.map(async (user) => {
          await sendResponseFinishedEmail(
            user.email,
            environmentId,
            survey,
            response,
            numberOfExistingResponses
          );
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
  }

  return NextResponse.json({ data: {} });
}
