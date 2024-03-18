import "server-only";

import { Prisma } from "@prisma/client";

import { TSurvey, TSurveyFilterCriteria } from "@formbricks/types/surveys";

export const formatSurveyDateFields = (survey: TSurvey): TSurvey => {
  if (typeof survey.createdAt === "string") {
    survey.createdAt = new Date(survey.createdAt);
  }
  if (typeof survey.updatedAt === "string") {
    survey.updatedAt = new Date(survey.updatedAt);
  }
  if (typeof survey.closeOnDate === "string") {
    survey.closeOnDate = new Date(survey.closeOnDate);
  }

  if (survey.segment) {
    if (typeof survey.segment.createdAt === "string") {
      survey.segment.createdAt = new Date(survey.segment.createdAt);
    }

    if (typeof survey.segment.updatedAt === "string") {
      survey.segment.updatedAt = new Date(survey.segment.updatedAt);
    }
  }

  return survey;
};

export const anySurveyHasFilters = (surveys: TSurvey[]) =>
  !surveys.every((survey) => !survey.segment?.filters?.length);

export const buildWhereClause = (filterCriteria?: TSurveyFilterCriteria) => {
  const whereClause: Prisma.SurveyWhereInput["AND"] = [];

  // for name
  if (filterCriteria?.name) {
    whereClause.push({ name: { contains: filterCriteria.name, mode: "insensitive" } });
  }

  // for status
  if (filterCriteria?.status && filterCriteria?.status?.length) {
    whereClause.push({ status: { in: filterCriteria.status } });
  }

  // for type
  if (filterCriteria?.type && filterCriteria?.type?.length) {
    whereClause.push({ type: { in: filterCriteria.type } });
  }

  // for createdBy
  if (filterCriteria?.createdBy?.value && filterCriteria?.createdBy?.value?.length) {
    if (filterCriteria.createdBy.value.length === 1) {
      if (filterCriteria.createdBy.value[0] === "you") {
        whereClause.push({ createdBy: filterCriteria.createdBy.userId });
      }
      if (filterCriteria.createdBy.value[0] === "others") {
        whereClause.push({ createdBy: { not: filterCriteria.createdBy.userId } });
      }
    }
  }

  return { AND: whereClause };
};

export const buildOrderByClause = (
  sortBy?: TSurveyFilterCriteria["sortBy"]
): Prisma.SurveyOrderByWithRelationInput[] | undefined => {
  if (!sortBy) {
    return undefined;
  }

  if (sortBy === "name") {
    return [{ name: "asc" }];
  }

  return [{ [sortBy]: "desc" }];
};
