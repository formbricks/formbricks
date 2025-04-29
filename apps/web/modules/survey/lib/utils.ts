import "server-only";
import { Prisma } from "@prisma/client";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey, TSurveyFilterCriteria } from "@formbricks/types/surveys/types";

export const transformPrismaSurvey = <T extends TSurvey | TJsEnvironmentStateSurvey>(
  surveyPrisma: any
): T => {
  let segment: TSegment | null = null;

  if (surveyPrisma.segment) {
    segment = {
      ...surveyPrisma.segment,
      surveys: surveyPrisma.segment.surveys.map((survey) => survey.id),
    };
  }

  const transformedSurvey = {
    ...surveyPrisma,
    displayPercentage: Number(surveyPrisma.displayPercentage) || null,
    segment,
  } as T;

  return transformedSurvey;
};

export const buildWhereClause = (filterCriteria?: TSurveyFilterCriteria) => {
  const whereClause: Prisma.SurveyWhereInput["AND"] = [];

  // for name
  if (filterCriteria?.name) {
    whereClause.push({ name: { contains: filterCriteria.name, mode: "insensitive" } });
  }

  // for status
  if (filterCriteria?.status?.length) {
    whereClause.push({ status: { in: filterCriteria.status } });
  }

  // for type
  if (filterCriteria?.type?.length) {
    whereClause.push({ type: { in: filterCriteria.type } });
  }

  // for createdBy
  const createdByValue = filterCriteria?.createdBy?.value;
  const userId = filterCriteria?.createdBy?.userId;
  const isCreatedByYou = createdByValue?.length === 1 && createdByValue[0] === "you" && userId;
  const isCreatedByOthers = createdByValue?.length === 1 && createdByValue[0] === "others" && userId;

  if (isCreatedByYou) {
    whereClause.push({ createdBy: userId });
  }

  if (isCreatedByOthers) {
    whereClause.push({
      OR: [{ createdBy: { not: userId } }, { createdBy: null }],
    });
  }

  return { AND: whereClause };
};

export const buildOrderByClause = (
  sortBy?: TSurveyFilterCriteria["sortBy"]
): Prisma.SurveyOrderByWithRelationInput[] | undefined => {
  const orderMapping: { [key: string]: Prisma.SurveyOrderByWithRelationInput } = {
    name: { name: "asc" },
    createdAt: { createdAt: "desc" },
    updatedAt: { updatedAt: "desc" },
  };

  return sortBy ? [orderMapping[sortBy] || { updatedAt: "desc" }] : undefined;
};

export const anySurveyHasFilters = (surveys: TSurvey[]): boolean => {
  return surveys.some((survey) => {
    if ("segment" in survey && survey.segment) {
      return survey.segment.filters && survey.segment.filters.length > 0;
    }
    return false;
  });
};
