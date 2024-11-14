import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { responseCache } from "@formbricks/lib/response/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { getInProgressSurveyCount } from "@formbricks/lib/survey/service";
import { buildOrderByClause, buildWhereClause } from "@formbricks/lib/survey/utils";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZOptionalNumber } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurveyFilterCriteria } from "@formbricks/types/surveys/types";
import { TSurvey } from "../types/surveys";

export const surveySelect: Prisma.SurveySelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  type: true,
  creator: {
    select: {
      name: true,
    },
  },
  status: true,
  singleUse: true,
  environmentId: true,
  _count: {
    select: { responses: true },
  },
};

export const getSurveys = reactCache(
  async (
    environmentId: string,
    limit?: number,
    offset?: number,
    filterCriteria?: TSurveyFilterCriteria
  ): Promise<TSurvey[]> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId], [limit, ZOptionalNumber], [offset, ZOptionalNumber]);

        try {
          if (filterCriteria?.sortBy === "relevance") {
            // Call the sortByRelevance function
            return await getSurveysSortedByRelevance(environmentId, limit, offset ?? 0, filterCriteria);
          }

          // Fetch surveys normally with pagination and include response count
          const surveysPrisma = await prisma.survey.findMany({
            where: {
              environmentId,
              ...buildWhereClause(filterCriteria),
            },
            select: surveySelect,
            orderBy: buildOrderByClause(filterCriteria?.sortBy),
            take: limit,
            skip: offset,
          });

          return surveysPrisma.map((survey) => {
            return {
              ...survey,
              responseCount: survey._count.responses,
            };
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`surveyList-getSurveys-${environmentId}-${limit}-${offset}-${JSON.stringify(filterCriteria)}`],
      {
        tags: [
          surveyCache.tag.byEnvironmentId(environmentId),
          responseCache.tag.byEnvironmentId(environmentId),
        ],
      }
    )()
);

export const getSurveysSortedByRelevance = reactCache(
  async (
    environmentId: string,
    limit?: number,
    offset?: number,
    filterCriteria?: TSurveyFilterCriteria
  ): Promise<TSurvey[]> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId], [limit, ZOptionalNumber], [offset, ZOptionalNumber]);

        try {
          let surveys: TSurvey[] = [];
          const inProgressSurveyCount = await getInProgressSurveyCount(environmentId, filterCriteria);

          // Fetch surveys that are in progress first
          const inProgressSurveys =
            offset && offset > inProgressSurveyCount
              ? []
              : await prisma.survey.findMany({
                  where: {
                    environmentId,
                    status: "inProgress",
                    ...buildWhereClause(filterCriteria),
                  },
                  select: surveySelect,
                  orderBy: buildOrderByClause("updatedAt"),
                  take: limit,
                  skip: offset,
                });

          surveys = inProgressSurveys.map((survey) => {
            return {
              ...survey,
              responseCount: survey._count.responses,
            };
          });

          // Determine if additional surveys are needed
          if (offset !== undefined && limit && inProgressSurveys.length < limit) {
            const remainingLimit = limit - inProgressSurveys.length;
            const newOffset = Math.max(0, offset - inProgressSurveyCount);
            const additionalSurveys = await prisma.survey.findMany({
              where: {
                environmentId,
                status: { not: "inProgress" },
                ...buildWhereClause(filterCriteria),
              },
              select: surveySelect,
              orderBy: buildOrderByClause("updatedAt"),
              take: remainingLimit,
              skip: newOffset,
            });

            surveys = [
              ...surveys,
              ...additionalSurveys.map((survey) => {
                return {
                  ...survey,
                  responseCount: survey._count.responses,
                };
              }),
            ];
          }

          return surveys;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [
        `surveyList-getSurveysSortedByRelevance-${environmentId}-${limit}-${offset}-${JSON.stringify(filterCriteria)}`,
      ],
      {
        tags: [
          surveyCache.tag.byEnvironmentId(environmentId),
          responseCache.tag.byEnvironmentId(environmentId),
        ],
      }
    )()
);

export const getSurvey = reactCache(
  async (surveyId: string): Promise<TSurvey | null> =>
    cache(
      async () => {
        validateInputs([surveyId, ZId]);

        let surveyPrisma;
        try {
          surveyPrisma = await prisma.survey.findUnique({
            where: {
              id: surveyId,
            },
            select: surveySelect,
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }

        if (!surveyPrisma) {
          return null;
        }

        return { ...surveyPrisma, responseCount: surveyPrisma?._count.responses };
      },
      [`surveyList-getSurvey-${surveyId}`],
      {
        tags: [surveyCache.tag.byId(surveyId), responseCache.tag.bySurveyId(surveyId)],
      }
    )()
);
