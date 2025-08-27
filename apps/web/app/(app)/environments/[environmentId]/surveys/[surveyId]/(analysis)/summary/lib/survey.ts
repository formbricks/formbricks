import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";

export const deleteResponsesAndDisplaysForSurvey = async (
  surveyId: string
): Promise<{ deletedResponsesCount: number; deletedDisplaysCount: number }> => {
  try {
    // Delete all responses for this survey

    const [deletedResponsesCount, deletedDisplaysCount] = await prisma.$transaction([
      prisma.response.deleteMany({
        where: {
          surveyId: surveyId,
        },
      }),
      prisma.display.deleteMany({
        where: {
          surveyId: surveyId,
        },
      }),
    ]);

    return {
      deletedResponsesCount: deletedResponsesCount.count,
      deletedDisplaysCount: deletedDisplaysCount.count,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getQuotasSummary = async (surveyId: string) => {
  try {
    const quotas = await prisma.surveyQuota.findMany({
      where: {
        surveyId: surveyId,
      },
      select: {
        _count: {
          select: {
            quotaLinks: {
              where: {
                status: "screenedIn",
              },
            },
          },
        },
        id: true,
        name: true,
        limit: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return quotas.map((quota) => {
      const { _count, ...rest } = quota;
      const count = _count.quotaLinks;

      return {
        ...rest,
        count,
        percentage: (count / quota.limit) * 100,
      };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
