import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import { TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey, TSurveyFilterCriteria } from "@formbricks/types/surveys/types";

export const transformPrismaSurvey = <T extends TSurvey | TJsWorkspaceStateSurvey>(surveyPrisma: any): T => {
  let segment: TSegment | null = null;

  if (surveyPrisma.segment) {
    segment = {
      ...surveyPrisma.segment,
      surveys: surveyPrisma.segment.surveys.map((survey: { id: string }) => survey.id),
    };
  }

  const transformedSurvey = {
    ...surveyPrisma,
    displayPercentage: Number(surveyPrisma.displayPercentage) || null,
    segment,
    customHeadScriptsMode: surveyPrisma.customHeadScriptsMode,
  } as T;

  return transformedSurvey;
};

// Status + archived (soft-delete) handling.
// Archived surveys (archivedAt not null) are hidden by default. The "Archived" filter sets
// includeArchived; the server never receives a real "archived" status.
const buildStatusArchivedClauses = (filterCriteria?: TSurveyFilterCriteria): Prisma.SurveyWhereInput[] => {
  const hasStatusFilter = Boolean(filterCriteria?.status?.length);

  if (filterCriteria?.includeArchived) {
    if (hasStatusFilter) {
      // Selected active statuses OR any archived survey (Archived behaves like an extra status).
      return [
        { OR: [{ status: { in: filterCriteria!.status }, archivedAt: null }, { archivedAt: { not: null } }] },
      ];
    }
    // Only archived surveys.
    return [{ archivedAt: { not: null } }];
  }

  // Default: exclude archived surveys, optionally narrowing to the selected statuses.
  const clauses: Prisma.SurveyWhereInput[] = [{ archivedAt: null }];
  if (hasStatusFilter) {
    clauses.push({ status: { in: filterCriteria!.status } });
  }
  return clauses;
};

const buildCreatedByClause = (
  createdBy?: TSurveyFilterCriteria["createdBy"]
): Prisma.SurveyWhereInput | null => {
  // Only a single-value createdBy filter maps to a clause ("you" or "others").
  if (createdBy?.value?.length !== 1) {
    return null;
  }

  if (createdBy.value[0] === "you") {
    return { createdBy: createdBy.userId };
  }
  if (createdBy.value[0] === "others") {
    return { OR: [{ createdBy: { not: createdBy.userId } }, { createdBy: null }] };
  }
  return null;
};

export const buildWhereClause = (filterCriteria?: TSurveyFilterCriteria) => {
  const whereClause: Prisma.SurveyWhereInput["AND"] = [];

  // for name
  if (filterCriteria?.name) {
    whereClause.push({ name: { contains: filterCriteria.name, mode: "insensitive" } });
  }

  whereClause.push(...buildStatusArchivedClauses(filterCriteria));

  // for type
  if (filterCriteria?.type?.length) {
    whereClause.push({ type: { in: filterCriteria.type } });
  }

  // for createdBy
  const createdByClause = buildCreatedByClause(filterCriteria?.createdBy);
  if (createdByClause) {
    whereClause.push(createdByClause);
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
