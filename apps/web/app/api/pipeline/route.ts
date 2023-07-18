import { INTERNAL_SECRET } from "@formbricks/lib/constants";
import { prisma } from "@formbricks/database";
import { NextResponse } from "next/server";
import { AttributeClass } from "@prisma/client";
import { sendResponseFinishedEmail } from "@/lib/email";
import { Question } from "@formbricks/types/questions";
import { NotificationSettings } from "@formbricks/types/users";
import { ZPipelineInput } from "@formbricks/types/v1/pipelines";
import { responses } from "@/lib/api/response";
import { transformErrorToDetails } from "@/lib/api/validator";

export async function POST(request: Request) {
  const jsonInput = await request.json();

  const inputValidation = ZPipelineInput.safeParse(jsonInput);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  const { internalSecret, environmentId, surveyId, event, data } = inputValidation.data;

  if (internalSecret !== INTERNAL_SECRET) {
    console.error("Pipeline: internalSecret doesn't match");
    return new Response("Invalid internalSecret", {
      status: 401,
    });
  }

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
        body: JSON.stringify({
          webhookId: webhook.id,
          event,
          data,
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
    // filter all users that have email notifications enabled for this survey
    const usersWithNotifications = users.filter((user) => {
      const notificationSettings: NotificationSettings | null = user.notificationSettings;
      if (notificationSettings?.alert && notificationSettings.alert[surveyId]) {
        return true;
      }
      return false;
    });

    if (usersWithNotifications.length > 0) {
      // get survey
      const surveyData = await prisma.survey.findUnique({
        where: {
          id: surveyId,
        },
        select: {
          id: true,
          name: true,
          questions: true,
        },
      });
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
        questions: JSON.parse(JSON.stringify(surveyData.questions)) as Question[],
      };
      // get person for response
      let person: {
        id: string;
        attributes: { id: string; value: string; attributeClass: AttributeClass }[];
      } | null;
      if (data.personId) {
        person = await prisma.person.findUnique({
          where: {
            id: data.personId,
          },
          select: {
            id: true,
            attributes: {
              select: {
                id: true,
                value: true,
                attributeClass: true,
              },
            },
          },
        });
      }
      // send email to all users
      await Promise.all(
        usersWithNotifications.map(async (user) => {
          await sendResponseFinishedEmail(user.email, environmentId, survey, data, person);
        })
      );
    }

    const updateSurveyStatus = async (surveyId: string) => {
      // Get the survey instance by surveyId
      const survey = await prisma.survey.findUnique({
        where: {
          id: surveyId,
        },
        select: {
          autoComplete: true,
        },
      });

      if (survey?.autoComplete) {
        // Get the number of responses to a survey
        const responseCount = await prisma.response.count({
          where: {
            surveyId: surveyId,
          },
        });
        if (responseCount === survey.autoComplete) {
          await prisma.survey.update({
            where: {
              id: surveyId,
            },
            data: {
              status: "completed",
            },
          });
        }
      }
    };
    await updateSurveyStatus(surveyId);
  }

  return NextResponse.json({ data: {} });
}
