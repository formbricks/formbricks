import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId, ZString } from "@formbricks/types/common";
import {
  DatabaseError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import {
  DATE_OPERATORS,
  TAllOperators,
  TBaseFilters,
  TDateOperator,
  TEvaluateSegmentUserAttributeData,
  TEvaluateSegmentUserData,
  TSegment,
  TSegmentAttributeFilter,
  TSegmentConnector,
  TSegmentCreateInput,
  TSegmentDeviceFilter,
  TSegmentFilterValue,
  TSegmentPersonFilter,
  TSegmentSegmentFilter,
  TSegmentSurveyInteractionFilter,
  TSegmentUpdateInput,
  TSegmentWithSurveyRefs,
  ZRelativeDateValue,
  ZSegmentCreateInput,
  ZSegmentFilters,
  ZSegmentUpdateInput,
} from "@formbricks/types/segment";
import { getSurvey } from "@/lib/survey/service";
import { andVisibleSurveys } from "@/lib/survey/visibility/predicate";
import { isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { validateInputs } from "@/lib/utils/validate";
import {
  SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE,
  isResourceFilter,
  searchForAttributeKeyInSegment,
} from "@/modules/ee/contacts/segments/lib/utils";
import { isSameDay, subtractTimeUnit } from "./date-utils";
import { combineFilterResults, evaluateSurveyInteractionFilterInMemory } from "./filter/survey-interaction";
import { SEGMENT_TITLE_TAKEN_ERROR_MESSAGE } from "./segment-errors";

export type PrismaSegment = Prisma.SegmentGetPayload<{
  include: {
    surveys: {
      select: {
        id: true;
        name: true;
        status: true;
      };
    };
  };
}>;

export const selectSegment = {
  id: true,
  createdAt: true,
  updatedAt: true,
  title: true,
  description: true,
  workspaceId: true,
  filters: true,
  isPrivate: true,
  surveys: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
} satisfies Prisma.SegmentSelect;

export const transformPrismaSegment = (segment: PrismaSegment): TSegmentWithSurveyRefs => {
  const activeSurveys = segment.surveys
    .filter((survey) => survey.status === "inProgress")
    .map((survey) => ({ id: survey.id, name: survey.name }));

  const inactiveSurveys = segment.surveys
    .filter((survey) => survey.status !== "inProgress")
    .map((survey) => ({ id: survey.id, name: survey.name }));

  return {
    ...segment,
    surveys: segment.surveys.map((survey) => survey.id),
    activeSurveys,
    inactiveSurveys,
  };
};

export const getSegment = reactCache(async (segmentId: string): Promise<TSegmentWithSurveyRefs> => {
  validateInputs([segmentId, ZId]);
  try {
    const segment = await prisma.segment.findUnique({
      where: {
        id: segmentId,
      },
      select: selectSegment,
    });

    if (!segment) {
      throw new ResourceNotFoundError("segment", segmentId);
    }

    return transformPrismaSegment(segment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

/**
 * The filters of several segments in one read, for the recursion check: a level of references costs one
 * query instead of one per segment. Scoped to the workspace, like every other nested-segment read, so a
 * tree naming another workspace's segment is refused rather than followed. Only ids that exist come back;
 * the caller reports a missing one, so it names the id its walk met.
 */
export const getSegmentsByIds = async (
  segmentIds: string[],
  workspaceId: string
): Promise<{ id: string; filters: TBaseFilters }[]> => {
  validateInputs([segmentIds, z.array(ZId)], [workspaceId, ZId]);
  try {
    const segments = await prisma.segment.findMany({
      where: { id: { in: segmentIds }, workspaceId },
      select: { id: true, filters: true },
    });
    return segments.map((segment) => ({ id: segment.id, filters: segment.filters as TBaseFilters }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

/**
 * `getSegments`' survey-reference scope for the server-side callers that need every survey a segment is
 * attached to, visible to the viewer or not — reference validation and copy naming, whose results never
 * reach a browser. A shared constant, not an inline `{}`, so `reactCache` keeps its dedupe and every
 * unscoped caller is greppable.
 */
export const ALL_SEGMENT_SURVEY_REFS: Prisma.SurveyWhereInput = Object.freeze({});

/**
 * @param visibleSurveyWhere ENG-3282: the `Survey` clause each segment's `activeSurveys` /
 *   `inactiveSurveys` are read through. Required, so no page can forget it and ship restricted survey
 *   names and ids to the browser: pass `getUserVisibleSurveyWhere(...)` for anything a viewer sees, and
 *   `ALL_SEGMENT_SURVEY_REFS` only where the result stays on the server.
 */
export const getSegments = reactCache(
  async (
    workspaceId: string,
    visibleSurveyWhere: Prisma.SurveyWhereInput
  ): Promise<TSegmentWithSurveyRefs[]> => {
    validateInputs([workspaceId, ZId]);
    try {
      const segments = await prisma.segment.findMany({
        where: {
          workspaceId,
        },
        select:
          Object.keys(visibleSurveyWhere).length > 0
            ? { ...selectSegment, surveys: { ...selectSegment.surveys, where: visibleSurveyWhere } }
            : selectSegment,
      });

      if (!segments) {
        return [];
      }

      return segments.map((segment) => transformPrismaSegment(segment));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export interface TSurveyFilterRef {
  id: string;
  name: string;
  status: string;
}

/**
 * Upper bound on surveys returned for the picker. Keeps the query and client payload from growing
 * unboundedly with the workspace's survey count; the picker searches client-side over this set. A
 * workspace exceeding this many surveys would need server-side search (tracked as a follow-up), which
 * is far beyond any realistic count today.
 */
export const SURVEY_FILTER_REF_LIMIT = 1000;

/**
 * Minimal survey list for the segment survey-interaction filter picker: id + name + status,
 * scoped to the workspace. Survey has a direct workspaceId column so no environment/project join
 * is needed. Bounded by {@link SURVEY_FILTER_REF_LIMIT}, most-recently-updated first.
 */
export const getSurveyRefsForWorkspace = reactCache(
  async (
    workspaceId: string,
    /** ENG-3282: the viewer's survey-visibility clause. */
    visibleSurveyWhere: Prisma.SurveyWhereInput
  ): Promise<TSurveyFilterRef[]> => {
    validateInputs([workspaceId, ZId]);
    try {
      return await prisma.survey.findMany({
        where: { workspaceId, ...andVisibleSurveys(visibleSurveyWhere) },
        select: { id: true, name: true, status: true },
        orderBy: { updatedAt: "desc" },
        take: SURVEY_FILTER_REF_LIMIT,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

/**
 * Returns the subset of `surveyIds` that actually belong to `workspaceId`. Unlike
 * {@link getSurveyRefsForWorkspace} (which caps at {@link SURVEY_FILTER_REF_LIMIT} for the picker),
 * this queries by the exact ids being validated, so it stays correct for workspaces with more than
 * that many surveys — a referenced-but-valid survey outside the picker's recent window is no longer
 * wrongly rejected. Ids are deduplicated and looked up in bounded sequential batches (ENG-2305),
 * mirroring {@link getSurveyWorkspaceIdMap}. Returns an empty set for an empty input without
 * hitting the DB.
 *
 * @param visibleSurveyWhere ENG-3282: the caller's survey-visibility clause. Required, like
 *   {@link getSegments}', so a survey reference is never validated against surveys the caller cannot see
 *   by omission: a hidden id must answer exactly like an unknown one.
 */
export const getExistingWorkspaceSurveyIds = reactCache(
  async (
    workspaceId: string,
    surveyIds: string[],
    visibleSurveyWhere: Prisma.SurveyWhereInput
  ): Promise<Set<string>> => {
    validateInputs([workspaceId, ZId], [surveyIds, z.array(ZId)]);
    const uniqueSurveyIds = Array.from(new Set(surveyIds));
    const existingSurveyIds = new Set<string>();
    if (uniqueSurveyIds.length === 0) return existingSurveyIds;
    try {
      for (let i = 0; i < uniqueSurveyIds.length; i += SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE) {
        const batch = uniqueSurveyIds.slice(i, i + SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE);
        const surveys = await prisma.survey.findMany({
          where: { workspaceId, id: { in: batch }, ...andVisibleSurveys(visibleSurveyWhere) },
          select: { id: true },
        });
        for (const survey of surveys) {
          existingSurveyIds.add(survey.id);
        }
      }
      return existingSurveyIds;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

/**
 * ENG-6956: a survey's private targeting segment is stored under the survey's id as its title, and the
 * survey save finds (or connects to) it by that title. A segment a caller titles freely must therefore
 * never take a survey's id, or it would be picked up as that survey's targeting.
 */
const assertTitleIsNotSurveyId = async (workspaceId: string, title: string): Promise<void> => {
  const survey = await prisma.survey.findFirst({ where: { id: title, workspaceId }, select: { id: true } });
  if (survey) {
    throw new InvalidInputError("A segment cannot be titled with the id of a survey");
  }
};

const isRename = (data: TSegmentUpdateInput, current: TSegment): boolean =>
  data.title !== undefined && data.title !== current.title;

/**
 * A segment that stays private keeps its survey's id as title: the survey save finds it by that title, so
 * a renamed one would be left behind and a new one created (ENG-6956). Turning it shared may rename it.
 */
const assertPrivateSegmentKeepsTitle = (data: TSegmentUpdateInput, current: TSegment): void => {
  const staysPrivate = current.isPrivate && data.isPrivate !== false;
  if (staysPrivate && isRename(data, current)) {
    throw new InvalidInputError("A private segment keeps the id of its survey as title");
  }
};

/**
 * A rename, or a private segment turned shared while it keeps its survey's id as title, stores a title
 * the caller chose for a segment the survey save may later pick up by that title (ENG-6956).
 */
const needsSurveyIdTitleCheck = (data: TSegmentUpdateInput, current: TSegment): boolean => {
  const becomesShared = current.isPrivate && data.isPrivate === false;
  return isRename(data, current) || becomesShared;
};

/**
 * Titles are unique per workspace, so a create or rename onto a title another segment holds (a survey's
 * private segment included) is the caller's input error, not a database fault.
 */
const throwSegmentTitleTaken = (error: unknown): void => {
  if (isUniqueConstraintError(error)) {
    throw new InvalidInputError(SEGMENT_TITLE_TAKEN_ERROR_MESSAGE);
  }
};

/**
 * A survey's private targeting segment: created on its first save, updated on later ones (auto-save may
 * already have made it). ENG-6956: keyed by the survey's id, chosen here (see ZSegmentCreateInput); the
 * caller authorizes `survey.write` on `surveyId`. The update reaches only a private segment no other
 * survey uses. Prisma runs this upsert as a read then a write, so two first saves can race; the one that
 * loses finds the row on its second try. A second clash means another segment holds the title.
 */
const upsertPrivateSegment = async ({
  workspaceId,
  surveyId,
  description,
  filters,
}: Pick<TSegmentCreateInput, "workspaceId" | "surveyId" | "description" | "filters">) => {
  const upsert = () =>
    prisma.segment.upsert({
      // A shared segment holding the title, or a private one other surveys also use (only possible
      // through older bugs), is not this survey's to rewrite: the create clashes and the save is refused.
      where: {
        workspaceId_title: { workspaceId, title: surveyId },
        isPrivate: true,
        surveys: { every: { id: surveyId } },
      },
      create: {
        workspaceId,
        title: surveyId,
        description,
        isPrivate: true,
        filters,
        surveys: { connect: { id: surveyId } },
      },
      update: { description, filters, surveys: { connect: { id: surveyId } } },
      select: selectSegment,
    });

  try {
    return await upsert();
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    return await upsert();
  }
};

export const createSegment = async (segmentCreateInput: TSegmentCreateInput): Promise<TSegment> => {
  validateInputs([segmentCreateInput, ZSegmentCreateInput]);

  const { description, filters, isPrivate, surveyId, title, workspaceId } = segmentCreateInput;

  const surveyConnect = surveyId ? { surveys: { connect: { id: surveyId } } } : {};

  try {
    if (isPrivate) {
      return transformPrismaSegment(await upsertPrivateSegment(segmentCreateInput));
    }

    await assertTitleIsNotSurveyId(workspaceId, title);

    const segment = await prisma.segment.create({
      data: {
        workspaceId,
        title,
        description,
        isPrivate,
        filters,
        ...surveyConnect,
      },
      select: selectSegment,
    });

    return transformPrismaSegment(segment);
  } catch (error) {
    throwSegmentTitleTaken(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const cloneSegment = async (segmentId: string, surveyId: string): Promise<TSegment> => {
  validateInputs([segmentId, ZId], [surveyId, ZId]);

  try {
    const segment = await getSegment(segmentId);
    if (!segment) {
      throw new ResourceNotFoundError("segment", segmentId);
    }

    if (!segment.workspaceId) {
      throw new DatabaseError("Segment is not associated with a workspace");
    }

    const allSegments = await getSegments(segment.workspaceId, ALL_SEGMENT_SURVEY_REFS);

    // Find the last "Copy of" title and extract the number from it
    const lastCopyTitle = allSegments
      .map((existingSegment) => existingSegment.title)
      .filter((title) => title.startsWith(`Copy of ${segment.title}`))
      .pop();

    let suffix = 1;
    if (lastCopyTitle) {
      const regex = /\((\d+)\)$/;
      const match = regex.exec(lastCopyTitle);
      if (match) {
        suffix = parseInt(match[1], 10) + 1;
      }
    }

    // Construct the title for the cloned segment
    const clonedTitle = `Copy of ${segment.title} (${suffix})`;

    // parse the filters and update the user segment
    const parsedFilters = ZSegmentFilters.safeParse(segment.filters);
    if (!parsedFilters.success) {
      throw new ValidationError("Invalid filters");
    }

    const clonedSegment = await prisma.segment.create({
      data: {
        title: clonedTitle,
        description: segment.description,
        isPrivate: segment.isPrivate,
        workspaceId: segment.workspaceId,
        filters: segment.filters,
        surveys: {
          connect: {
            id: surveyId,
          },
        },
      },
      select: selectSegment,
    });

    return transformPrismaSegment(clonedSegment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const deleteSegment = async (segmentId: string): Promise<TSegment> => {
  validateInputs([segmentId, ZId]);

  try {
    const currentSegment = await getSegment(segmentId);
    if (!currentSegment) {
      throw new ResourceNotFoundError("segment", segmentId);
    }

    if (currentSegment.surveys?.length) {
      throw new OperationNotAllowedError("Cannot delete a segment that is associated with a survey");
    }

    const segment = await prisma.segment.delete({
      where: {
        id: segmentId,
      },
      select: selectSegment,
    });

    return transformPrismaSegment(segment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const resetSegmentInSurvey = async (surveyId: string): Promise<TSegment> => {
  validateInputs([surveyId, ZId]);

  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new ResourceNotFoundError("survey", surveyId);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // for this survey, does a private segment already exist. Titles are unique per workspace only, so
      // another workspace can hold a private segment titled with this survey's id (ENG-7389).
      const segment = await tx.segment.findFirst({
        where: {
          workspaceId: survey.workspaceId,
          title: surveyId,
          isPrivate: true,
        },
        select: selectSegment,
      });

      // if a private segment already exists, connect it to the survey
      if (segment) {
        await tx.survey.update({
          where: { id: surveyId },
          data: { segment: { connect: { id: segment.id } } },
        });

        // reset the filters
        const updatedSegment = await tx.segment.update({
          where: { id: segment.id },
          data: { filters: [] },
          select: selectSegment,
        });

        return transformPrismaSegment(updatedSegment);
      } else {
        // This case should never happen because a private segment with the title of the surveyId
        // should always exist. But, handling it just in case.

        // if a private segment does not exist, create one
        const newPrivateSegment = await tx.segment.create({
          data: {
            title: surveyId,
            isPrivate: true,
            filters: [],
            surveys: { connect: { id: surveyId } },
            workspaceId: survey.workspaceId,
          },
          select: selectSegment,
        });

        return transformPrismaSegment(newPrivateSegment);
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

/**
 * Batched lookup of the owning workspace for a set of surveys, used to keep segment↔survey links
 * within one workspace (ENG-1920). Ids are deduplicated and queried in bounded batches — one query
 * per batch rather than one per id, so the non-N+1 shape is preserved without letting a
 * caller-controlled array size the SQL parameter payload (ENG-2004). Batches run sequentially: the
 * point is to cap concurrent database work, not to fan it out. Missing ids are simply absent from
 * the returned map.
 */
export const getSurveyWorkspaceIdMap = reactCache(
  async (surveyIds: string[]): Promise<Map<string, string>> => {
    const uniqueSurveyIds = Array.from(new Set(surveyIds));
    const workspaceIdBySurveyId = new Map<string, string>();

    if (uniqueSurveyIds.length === 0) {
      return workspaceIdBySurveyId;
    }

    try {
      for (let i = 0; i < uniqueSurveyIds.length; i += SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE) {
        const batch = uniqueSurveyIds.slice(i, i + SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE);
        const surveys = await prisma.survey.findMany({
          where: { id: { in: batch } },
          select: { id: true, workspaceId: true },
        });

        for (const survey of surveys) {
          workspaceIdBySurveyId.set(survey.id, survey.workspaceId);
        }
      }

      return workspaceIdBySurveyId;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const updateSegment = async (segmentId: string, data: TSegmentUpdateInput): Promise<TSegment> => {
  validateInputs([segmentId, ZId], [data, ZSegmentUpdateInput]);

  try {
    let updatedInput: Prisma.SegmentUpdateInput = {
      ...data,
      surveys: undefined,
    };

    if (data.surveys) {
      updatedInput = {
        ...data,
        surveys: {
          connect: data.surveys.map((surveyId) => ({ id: surveyId })),
        },
      };
    }

    const currentSegment = await getSegment(segmentId);
    if (!currentSegment) {
      throw new ResourceNotFoundError("segment", segmentId);
    }

    assertPrivateSegmentKeepsTitle(data, currentSegment);
    if (needsSurveyIdTitleCheck(data, currentSegment)) {
      await assertTitleIsNotSurveyId(currentSegment.workspaceId, data.title ?? currentSegment.title);
    }

    const segment = await prisma.segment.update({
      where: {
        id: segmentId,
      },
      data: updatedInput,
      select: selectSegment,
    });

    return transformPrismaSegment(segment);
  } catch (error) {
    throwSegmentTitleTaken(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getSegmentsByAttributeKey = reactCache(async (workspaceId: string, attributeKey: string) => {
  validateInputs([workspaceId, ZId], [attributeKey, ZString]);

  try {
    const segments = await prisma.segment.findMany({
      where: {
        workspaceId,
      },
      select: selectSegment,
    });

    // search for contactAttributeKey in the filters
    const clonedSegments = structuredClone(segments);

    const filteredSegments = clonedSegments.filter((segment) => {
      return searchForAttributeKeyInSegment(segment.filters, attributeKey);
    });

    return filteredSegments;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

const evaluateAttributeFilter = (
  attributes: TEvaluateSegmentUserAttributeData,
  filter: TSegmentAttributeFilter
): boolean => {
  const { value, qualifier, root } = filter;
  const { contactAttributeKey } = root;
  const { operator } = qualifier;

  const attributeValue = attributes[contactAttributeKey];

  // Handle isSet and isNotSet operators first - they have special logic
  if (operator === "isSet") {
    // Return true if the attribute exists and has a truthy value
    return attributeValue !== undefined && attributeValue !== null && attributeValue !== "";
  }

  if (operator === "isNotSet") {
    // Return true if the attribute doesn't exist or has a falsy value
    return attributeValue === undefined || attributeValue === null || attributeValue === "";
  }

  // For all other operators, if the attribute doesn't exist, return false
  if (attributeValue === undefined || attributeValue === null) {
    return false;
  }

  // Check if this is a date operator
  if (isDateOperator(operator)) {
    return evaluateDateFilter(String(attributeValue), value, operator);
  }

  // Use standard comparison for non-date operators
  // For non-date operators, value is always string | number
  const attResult = compareValues(attributeValue, value as string | number, operator);
  return attResult;
};

const evaluatePersonFilter = (userId: string, filter: TSegmentPersonFilter): boolean => {
  const { value, qualifier, root } = filter;
  const { personIdentifier } = root;

  if (personIdentifier === "userId") {
    // For userId comparison, value is always string | number
    const attResult = compareValues(userId, value as string | number, qualifier.operator);
    return attResult;
  }

  return false;
};

const evaluateSegmentFilter = async (
  userData: TEvaluateSegmentUserData,
  filter: TSegmentSegmentFilter
): Promise<boolean> => {
  const { qualifier, root } = filter;
  const { segmentId } = root;
  const { operator } = qualifier;

  const segment = await getSegment(segmentId);

  if (!segment) {
    return false;
  }

  const parsedFilters = ZSegmentFilters.safeParse(segment.filters);
  if (!parsedFilters.success) {
    return false;
  }

  const isInSegment = await evaluateSegment(userData, parsedFilters.data);

  if (operator === "userIsIn") {
    return isInSegment;
  }

  if (operator === "userIsNotIn") {
    return !isInSegment;
  }

  return false;
};

const evaluateDeviceFilter = (device: "phone" | "desktop", filter: TSegmentDeviceFilter): boolean => {
  const { value, qualifier } = filter;
  // For device comparison, value is always string | number
  return compareValues(device, value as string | number, qualifier.operator);
};

/**
 * Checks if an operator is a date-specific operator
 */
const isDateOperator = (operator: TAllOperators): operator is TDateOperator => {
  return DATE_OPERATORS.includes(operator as TDateOperator);
};

/**
 * Evaluates a date filter against an attribute value
 */
const evaluateDateFilter = (
  attributeValue: string,
  filterValue: TSegmentFilterValue,
  operator: TDateOperator
): boolean => {
  // Parse the attribute value as a date
  const attrDate = new Date(attributeValue);

  // Validate the attribute value is a valid date
  if (Number.isNaN(attrDate.getTime())) {
    return false;
  }

  // Check if filterValue is a relative date value (e.g., { amount: 30, unit: "days" })
  const relativeDateParsed = ZRelativeDateValue.safeParse(filterValue);

  if (relativeDateParsed.success) {
    const now = new Date();
    const threshold = subtractTimeUnit(now, relativeDateParsed.data.amount, relativeDateParsed.data.unit);
    return operator === "isOlderThan" ? attrDate < threshold : attrDate >= threshold;
  }

  // Handle absolute date operators
  switch (operator) {
    case "isBefore":
    case "isAfter":
    case "isSameDay": {
      if (typeof filterValue !== "string") return false;
      const compareDate = new Date(filterValue);
      if (operator === "isBefore") return attrDate < compareDate;
      if (operator === "isAfter") return attrDate > compareDate;
      return isSameDay(attrDate, compareDate);
    }
    case "isBetween": {
      if (!Array.isArray(filterValue) || filterValue.length !== 2) return false;
      const startDate = new Date(filterValue[0]);
      const endDate = new Date(filterValue[1]);
      return attrDate >= startDate && attrDate <= endDate;
    }
    default:
      return false;
  }
};

export const compareValues = (
  a: string | number | undefined,
  b: string | number,
  operator: TAllOperators
): boolean => {
  switch (operator) {
    case "equals":
      return a === b;
    case "notEquals":
      return a !== b;
    case "lessThan":
      return (a as number) < (b as number);
    case "lessEqual":
      return (a as number) <= (b as number);
    case "greaterThan":
      return (a as number) > (b as number);
    case "greaterEqual":
      return (a as number) >= (b as number);
    case "isSet":
      return a !== undefined;
    case "isNotSet":
      return a === "" || a === null || a === undefined;
    case "contains":
      return (a as string).includes(b as string);
    case "doesNotContain":
      return !(a as string).includes(b as string);
    case "startsWith":
      return (a as string).startsWith(b as string);
    case "endsWith":
      return (a as string).endsWith(b as string);
    default:
      throw new Error(`Unexpected operator: ${operator}`);
  }
};

type ResultConnectorPair = {
  result: boolean;
  connector: TSegmentConnector;
};

export const evaluateSegment = async (
  userData: TEvaluateSegmentUserData,
  filters: TBaseFilters
): Promise<boolean> => {
  if (!filters.length) {
    // if there are no filters, the segment will be evaluated as true
    return true;
  }

  const resultPairs: ResultConnectorPair[] = [];
  const now = new Date();

  try {
    for (const filterItem of filters) {
      const { resource } = filterItem;

      let result: boolean;

      if (isResourceFilter(resource)) {
        const { type } = resource.root;

        // Exhaustive switch: a new filter root type must be handled here or the `default` throws —
        // this replaces an if-chain that silently dropped unhandled types (e.g. surveyInteraction),
        // leaving `result` unassigned and corrupting segment membership.
        switch (type) {
          case "attribute":
            result = evaluateAttributeFilter(userData.attributes, resource as TSegmentAttributeFilter);
            break;
          case "person":
            result = evaluatePersonFilter(userData.userId, resource as TSegmentPersonFilter);
            break;
          case "segment":
            result = await evaluateSegmentFilter(userData, resource as TSegmentSegmentFilter);
            break;
          case "device":
            result = evaluateDeviceFilter(userData.deviceType, resource as TSegmentDeviceFilter);
            break;
          case "surveyInteraction":
            // This in-process evaluator can only resolve interaction filters when the caller supplies
            // the contact's interaction history. Throwing (rather than silently skipping) guarantees a
            // surveyInteraction filter can never be dropped here; the contact-sync and Prisma paths
            // evaluate these filters without needing this branch.
            if (!userData.interactionData) {
              throw new Error(
                "Cannot evaluate a surveyInteraction filter without interactionData on userData; evaluate via the contact-sync in-memory path or the Prisma query path instead."
              );
            }
            result = evaluateSurveyInteractionFilterInMemory(
              resource as TSegmentSurveyInteractionFilter,
              userData.interactionData,
              now
            );
            break;
          default:
            throw new Error(`Unsupported segment filter root type: ${type as string}`);
        }
      } else {
        // this is a sub-group and we need to evaluate the sub-group
        result = await evaluateSegment(userData, resource);
      }

      resultPairs.push({
        result,
        connector: filterItem.connector,
      });
    }

    // Combine the per-filter results with AND-before-OR precedence (shared with the in-memory
    // survey-interaction evaluator so both paths agree on connector semantics).
    return combineFilterResults(resultPairs);
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error(String(error)), "Error evaluating segment");

    throw error;
  }
};
