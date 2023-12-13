import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { sendResponseFinishedEmail } from "@/app/lib/email";
import { INTERNAL_SECRET } from "@formbricks/lib/constants";
import { convertDatesInObject } from "@formbricks/lib/time";
import { TSurveyQuestion } from "@formbricks/types/surveys";
import { TUserNotificationSettings } from "@formbricks/types/user";
import { ZPipelineInput } from "@formbricks/types/pipelines";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { handleIntegrations } from "./lib/handleIntegrations";
import { getWebhooksWithEvent } from "@formbricks/lib/webhook/service";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { updateSurveyStatus, getSurvey } from "@formbricks/lib/survey/service";
import { getTeamMembershipUsers } from "@formbricks/lib/profile/service";

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
  const webhooks = await getWebhooksWithEvent(environmentId, surveyId, event);

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
    const users = await getTeamMembershipUsers(environmentId);

    const integrations = await getIntegrations(environmentId);
    if (integrations.length > 0) {
      handleIntegrations(integrations, inputValidation.data);
    }
    // filter all users that have email notifications enabled for this survey
    const usersWithNotifications = users.filter((user) => {
      const notificationSettings: TUserNotificationSettings | null = user.notificationSettings;
      if (notificationSettings?.alert && notificationSettings.alert[surveyId]) {
        return true;
      }
      return false;
    });

    if (usersWithNotifications.length > 0) {
      // get survey
      const surveyData = await getSurvey(surveyId);
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
          await sendResponseFinishedEmail(user.email, environmentId, survey, response);
        })
      );
    }

    await updateSurveyStatus(surveyId);
  }

  return NextResponse.json({ data: {} });
}
