import { responses } from "@/app/lib/api/response";
import { headers } from "next/headers";

import { prisma } from "@formbricks/database";
import { sendNoLiveSurveyNotificationEmail, sendWeeklySummaryNotificationEmail } from "@formbricks/email";
import { CRON_SECRET } from "@formbricks/lib/constants";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { convertResponseValue } from "@formbricks/lib/responses";
import { replaceHeadlineRecall } from "@formbricks/lib/utils/recall";
import {
  TWeeklySummaryEnvironmentData,
  TWeeklySummaryNotificationDataSurvey,
  TWeeklySummaryNotificationResponse,
  TWeeklySummaryProductData,
  TWeeklySummarySurveyResponseData,
} from "@formbricks/types/weeklySummary";

const BATCH_SIZE = 500;

export const POST = async (): Promise<Response> => {
  // Check authentication
  if (headers().get("x-api-key") !== CRON_SECRET) {
    return responses.notAuthenticatedResponse();
  }

  const emailSendingPromises: Promise<void>[] = [];

  // Fetch all organization IDs
  const organizationIds = await getOrganizationIds();

  // Paginate through organizations
  for (let i = 0; i < organizationIds.length; i += BATCH_SIZE) {
    const batchedOrganizationIds = organizationIds.slice(i, i + BATCH_SIZE);
    // Fetch products for batched organizations asynchronously
    const batchedProductsPromises = batchedOrganizationIds.map((organizationId) =>
      getProductsByOrganizationId(organizationId)
    );

    const batchedProducts = await Promise.all(batchedProductsPromises);
    for (const products of batchedProducts) {
      for (const product of products) {
        const organizationMembers = product.organization.memberships;
        const organizationMembersWithNotificationEnabled = organizationMembers.filter(
          (member) =>
            member.user.notificationSettings?.weeklySummary &&
            member.user.notificationSettings.weeklySummary[product.id]
        );

        if (organizationMembersWithNotificationEnabled.length === 0) continue;

        const notificationResponse = getNotificationResponse(product.environments[0], product.name);

        if (notificationResponse.insights.numLiveSurvey === 0) {
          for (const organizationMember of organizationMembersWithNotificationEnabled) {
            emailSendingPromises.push(
              sendNoLiveSurveyNotificationEmail(organizationMember.user.email, notificationResponse)
            );
          }
          continue;
        }

        for (const organizationMember of organizationMembersWithNotificationEnabled) {
          emailSendingPromises.push(
            sendWeeklySummaryNotificationEmail(organizationMember.user.email, notificationResponse)
          );
        }
      }
    }
  }

  await Promise.all(emailSendingPromises);
  return responses.successResponse({}, true);
};

const getOrganizationIds = async (): Promise<string[]> => {
  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
    },
  });
  return organizations.map((organization) => organization.id);
};

const getProductsByOrganizationId = async (organizationId: string): Promise<TWeeklySummaryProductData[]> => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return await prisma.product.findMany({
    where: {
      organizationId: organizationId,
    },
    select: {
      id: true,
      name: true,
      environments: {
        where: {
          type: "production",
        },
        select: {
          id: true,
          surveys: {
            where: {
              NOT: {
                AND: [
                  { status: "completed" },
                  {
                    responses: {
                      none: {
                        createdAt: {
                          gte: sevenDaysAgo,
                        },
                      },
                    },
                  },
                ],
              },
              status: {
                not: "draft",
              },
            },
            select: {
              id: true,
              name: true,
              questions: true,
              status: true,
              responses: {
                where: {
                  createdAt: {
                    gte: sevenDaysAgo,
                  },
                },
                select: {
                  id: true,
                  createdAt: true,
                  updatedAt: true,
                  finished: true,
                  data: true,
                },
                orderBy: {
                  createdAt: "desc",
                },
              },
              displays: {
                where: {
                  createdAt: {
                    gte: sevenDaysAgo,
                  },
                },
                select: {
                  id: true,
                },
              },
              hiddenFields: true,
            },
          },
          attributeClasses: {
            select: {
              id: true,
              createdAt: true,
              updatedAt: true,
              name: true,
              description: true,
              type: true,
              environmentId: true,
              archived: true,
            },
          },
        },
      },
      organization: {
        select: {
          memberships: {
            select: {
              user: {
                select: {
                  email: true,
                  notificationSettings: true,
                },
              },
            },
          },
        },
      },
    },
  });
};

const getNotificationResponse = (
  environment: TWeeklySummaryEnvironmentData,
  productName: string
): TWeeklySummaryNotificationResponse => {
  const insights = {
    totalCompletedResponses: 0,
    totalDisplays: 0,
    totalResponses: 0,
    completionRate: 0,
    numLiveSurvey: 0,
  };

  const surveys: TWeeklySummaryNotificationDataSurvey[] = [];
  // iterate through the surveys and calculate the overall insights
  for (const survey of environment.surveys) {
    const parsedSurvey = replaceHeadlineRecall(survey, "default", environment.attributeClasses);
    const surveyData: TWeeklySummaryNotificationDataSurvey = {
      id: parsedSurvey.id,
      name: parsedSurvey.name,
      status: parsedSurvey.status,
      responseCount: parsedSurvey.responses.length,
      responses: [],
    };
    // iterate through the responses and calculate the survey insights
    for (const response of parsedSurvey.responses) {
      // only take the first 3 responses
      if (surveyData.responses.length >= 3) {
        break;
      }
      const surveyResponses: TWeeklySummarySurveyResponseData[] = [];
      for (const question of parsedSurvey.questions) {
        const headline = question.headline;
        const responseValue = convertResponseValue(response.data[question.id], question);
        const surveyResponse: TWeeklySummarySurveyResponseData = {
          headline: getLocalizedValue(headline, "default"),
          responseValue,
          questionType: question.type,
        };
        surveyResponses.push(surveyResponse);
      }
      surveyData.responses = surveyResponses;
    }
    surveys.push(surveyData);
    // calculate the overall insights
    if (survey.status == "inProgress") {
      insights.numLiveSurvey += 1;
    }
    insights.totalCompletedResponses += survey.responses.filter((r) => r.finished).length;
    insights.totalDisplays += survey.displays.length;
    insights.totalResponses += survey.responses.length;
    insights.completionRate = Math.round((insights.totalCompletedResponses / insights.totalResponses) * 100);
  }
  // build the notification response needed for the emails
  const lastWeekDate = new Date();
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  return {
    environmentId: environment.id,
    currentDate: new Date(),
    lastWeekDate,
    productName: productName,
    surveys,
    insights,
  };
};
