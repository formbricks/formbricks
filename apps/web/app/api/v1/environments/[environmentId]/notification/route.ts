import { prisma } from "@formbricks/database";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api/apiHelper";
import { responses } from "@/lib/api/response";
import { hasApiEnvironmentAccess, hasUserEnvironmentAccess } from "@/lib/api/apiHelper";
import { sendWeeklySummaryNotificationEmail, sendNoLiveSurveyNotificationEmail } from "@/lib/email";

export async function POST(
  _: Request,
  { params }: { params: { environmentId: string } }
): Promise<NextResponse> {
  const headersList = headers();
  const environmentId = params.environmentId;
  if (!environmentId) {
    return responses.badRequestResponse("Missing environmentId");
  }

  const hasAccess = await hasEnvironmentAccess(headersList, environmentId);
  if (!hasAccess) {
    return responses.notAuthenticatedResponse();
  }

  const email = await getEmailForNotification(headersList);
  if (email == undefined) {
    return responses.notFoundResponse("header", "x-api-key", true);
  }

  const notificationSettings = await getUserNotificationSetting(email);
  const surveyIds = Object.keys(notificationSettings).filter(
    (surveryId: string) => notificationSettings[surveryId]["weeklySummary"]
  );

  const productName = await getProductName(environmentId);
  if (productName == null) {
    return responses.notFoundResponse("product", "environmentId", true);
  }

  const currentDate = new Date();
  const lastWeekDate = new Date();
  lastWeekDate.setDate(currentDate.getDate() - 7);

  const rawWeeklySummaryData = await getNotificationData(surveyIds, currentDate, lastWeekDate);
  const surveyData = await getLatestSuveryResponses(rawWeeklySummaryData.rawResponseData);

  const notificationResponse = {
    environmentId: environmentId,
    currentDate: currentDate,
    lastWeekDate: lastWeekDate,
    productName: productName,
    surveyData: surveyData,
    insights: rawWeeklySummaryData.insights,
  };

  sendEmailNotification(email, notificationResponse);
  return responses.successResponse(notificationResponse, true);
}

const getNotificationData = async (surveyIds: any, currentDate: Date, lastWeekDate: Date) => {
  const latestResponseData = await prisma.response.findMany({
    where: {
      finished: true,
      createdAt: {
        gte: lastWeekDate.toISOString(),
        lte: currentDate.toISOString(),
      },
      survey: {
        id: {
          in: surveyIds,
        },
      },
    },
    distinct: ["surveyId"],
    include: {
      survey: {
        select: {
          id: true,
          questions: true,
          status: true,
          name: true,
        },
      },
    },
    orderBy: [
      {
        createdAt: "desc",
      },
    ],
  });

  const totalResponseCompleted = await prisma.response.count({
    where: {
      survey: {
        id: {
          in: surveyIds,
        },
      },
      finished: true,
      createdAt: {
        gte: lastWeekDate.toISOString(),
        lte: currentDate.toISOString(),
      },
    },
  });

  const totalDisplays = await prisma.display.count({
    where: {
      survey: {
        id: {
          in: surveyIds,
        },
      },
      createdAt: {
        gte: lastWeekDate.toISOString(),
        lte: currentDate.toISOString(),
      },
    },
  });

  const totalDisplaysResponded = await prisma.display.count({
    where: {
      survey: {
        id: {
          in: surveyIds,
        },
      },
      status: "responded",
      createdAt: {
        gte: lastWeekDate.toISOString(),
        lte: currentDate.toISOString(),
      },
    },
  });

  return {
    rawResponseData: latestResponseData,
    insights: {
      totalCompletedResponses: totalResponseCompleted,
      totalDisplays: totalDisplays,
      totalResponses: totalDisplaysResponded,
      completionRate: (totalResponseCompleted / totalDisplaysResponded) * 100,
      numLiveSurvey: latestResponseData.filter((response) => response.survey.status == "inProgress").length,
    },
  };
};

const getLatestSuveryResponses = async (notificationDatas) => {
  const liveSurveyStatus = ["inProgress", "paused", "completed"];
  const surveyResponses: any[] = [];

  for await (const notificationData of notificationDatas) {
    const responses: any[] = [];

    if (!liveSurveyStatus.includes(notificationData.survey.status)) {
      continue;
    } else if (notificationData.survey.questions) {
      for await (const question of notificationData.survey.questions) {
        const title = question.headline;
        const answer = notificationData.data[question.id];
        responses.push({ title: title, answer: answer });
      }
    }

    surveyResponses.push({
      id: notificationData.survey.id,
      surveyName: notificationData.survey.name,
      responses: responses,
    });
  }
  return surveyResponses;
};

const getEmailForNotification = async (headersList) => {
  if (headersList.get("x-api-key")) {
    return headersList.get("x-api-email");
  } else {
    const sessionUser = await getSessionUser();
    return sessionUser?.email;
  }
};

const getUserNotificationSetting = async (emailId) => {
  const user = await prisma.user.findUnique({
    where: {
      email: emailId,
    },
  });
  return user?.notificationSettings;
};

const sendEmailNotification = async (email, notificationResponse) => {
  if (notificationResponse.surveyData.length > 0) {
    await sendWeeklySummaryNotificationEmail(email, notificationResponse);
  } else {
    await sendNoLiveSurveyNotificationEmail(email, notificationResponse);
  }
};

const hasEnvironmentAccess = async (headersList, environmentId) => {
  if (headersList.get("x-api-key")) {
    const ownership = await hasApiEnvironmentAccess(headersList.get("x-api-key").toString(), environmentId);
    if (!ownership) {
      return false;
    }
  } else {
    const user = await getSessionUser();
    if (!user) {
      return false;
    }
    const ownership = await hasUserEnvironmentAccess(user, environmentId);
    if (!ownership) {
      return false;
    }
  }
  return true;
};

const getProductName = async (environmentId) => {
  const environment = await prisma.environment.findUnique({
    where: {
      id: environmentId,
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          teamId: true,
          brandColor: true,
          environments: true,
        },
      },
    },
  });

  if (environment === null) {
    return null;
  }

  const products = await prisma.product.findMany({
    where: {
      teamId: environment.product.teamId,
    },
    select: {
      id: true,
      name: true,
      brandColor: true,
      environments: {
        where: {
          type: "production",
        },
        select: {
          id: true,
        },
      },
    },
  });

  for await (const product of products) {
    if (product.id == environment.productId) {
      return product.name;
    }
  }
};
