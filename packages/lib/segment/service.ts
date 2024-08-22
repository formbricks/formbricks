import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import {
  DatabaseError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import {
  TActionMetric,
  TAllOperators,
  TBaseFilters,
  TEvaluateSegmentUserAttributeData,
  TEvaluateSegmentUserData,
  TSegment,
  TSegmentActionFilter,
  TSegmentAttributeFilter,
  TSegmentConnector,
  TSegmentCreateInput,
  TSegmentDeviceFilter,
  TSegmentPersonFilter,
  TSegmentSegmentFilter,
  TSegmentUpdateInput,
  ZSegmentCreateInput,
  ZSegmentFilters,
  ZSegmentUpdateInput,
} from "@formbricks/types/segment";
import {
  getActionCountInLastMonth,
  getActionCountInLastQuarter,
  getActionCountInLastWeek,
  getFirstOccurrenceDaysAgo,
  getLastOccurrenceDaysAgo,
  getTotalOccurrencesForAction,
} from "../action/service";
import { cache } from "../cache";
import { structuredClone } from "../pollyfills/structuredClone";
import { surveyCache } from "../survey/cache";
import { getSurvey } from "../survey/service";
import { validateInputs } from "../utils/validate";
import { segmentCache } from "./cache";
import { isResourceFilter, searchForAttributeClassNameInSegment } from "./utils";

type PrismaSegment = Prisma.SegmentGetPayload<{
  include: {
    surveys: {
      select: {
        id: true;
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
  environmentId: true,
  filters: true,
  isPrivate: true,
  surveys: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
};

export const transformPrismaSegment = (segment: PrismaSegment): TSegment => {
  return {
    ...segment,
    surveys: segment.surveys.map((survey) => survey.id),
  };
};

export const createSegment = async (segmentCreateInput: TSegmentCreateInput): Promise<TSegment> => {
  validateInputs([segmentCreateInput, ZSegmentCreateInput]);

  const { description, environmentId, filters, isPrivate, surveyId, title } = segmentCreateInput;

  let data: Prisma.SegmentCreateArgs["data"] = {
    environmentId,
    title,
    description,
    isPrivate,
    filters,
  };

  if (surveyId) {
    data = {
      ...data,
      surveys: {
        connect: {
          id: surveyId,
        },
      },
    };
  }

  try {
    const segment = await prisma.segment.create({
      data,
      select: selectSegment,
    });

    segmentCache.revalidate({ id: segment.id, environmentId });
    surveyCache.revalidate({ id: surveyId });

    return transformPrismaSegment(segment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getSegments = reactCache(
  (environmentId: string): Promise<TSegment[]> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);
        try {
          const segments = await prisma.segment.findMany({
            where: {
              environmentId,
            },
            select: selectSegment,
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
      },
      [`getSegments-${environmentId}`],
      {
        tags: [segmentCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const getSegment = reactCache(
  (segmentId: string): Promise<TSegment> =>
    cache(
      async () => {
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
      },
      [`getSegment-${segmentId}`],
      {
        tags: [segmentCache.tag.byId(segmentId)],
      }
    )()
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

    const segment = await prisma.segment.update({
      where: {
        id: segmentId,
      },
      data: updatedInput,
      select: selectSegment,
    });

    segmentCache.revalidate({ id: segmentId, environmentId: segment.environmentId });
    segment.surveys.map((survey) => surveyCache.revalidate({ id: survey.id }));

    return transformPrismaSegment(segment);
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

    segmentCache.revalidate({ id: segmentId, environmentId: segment.environmentId });
    segment.surveys.map((survey) => surveyCache.revalidate({ id: survey.id }));

    surveyCache.revalidate({ environmentId: currentSegment.environmentId });

    return transformPrismaSegment(segment);
  } catch (error) {
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

    const allSegments = await getSegments(segment.environmentId);

    // Find the last "Copy of" title and extract the number from it
    const lastCopyTitle = allSegments
      .map((existingSegment) => existingSegment.title)
      .filter((title) => title.startsWith(`Copy of ${segment.title}`))
      .pop();

    let suffix = 1;
    if (lastCopyTitle) {
      const match = lastCopyTitle.match(/\((\d+)\)$/);
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
        environmentId: segment.environmentId,
        filters: segment.filters,
        surveys: {
          connect: {
            id: surveyId,
          },
        },
      },
      select: selectSegment,
    });

    segmentCache.revalidate({ id: clonedSegment.id, environmentId: clonedSegment.environmentId });
    surveyCache.revalidate({ id: surveyId });

    return transformPrismaSegment(clonedSegment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getSegmentsByAttributeClassName = reactCache(
  (environmentId: string, attributeClassName: string) =>
    cache(
      async () => {
        validateInputs([environmentId, ZId], [attributeClassName, ZString]);

        try {
          const segments = await prisma.segment.findMany({
            where: {
              environmentId,
            },
            select: selectSegment,
          });

          // search for attributeClassName in the filters
          const clonedSegments = structuredClone(segments);

          const filteredSegments = clonedSegments.filter((segment) => {
            return searchForAttributeClassNameInSegment(segment.filters, attributeClassName);
          });

          return filteredSegments;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getSegmentsByAttributeClassName-${environmentId}-${attributeClassName}`],
      {
        tags: [
          segmentCache.tag.byEnvironmentId(environmentId),
          segmentCache.tag.byAttributeClassName(attributeClassName),
        ],
      }
    )()
);

export const resetSegmentInSurvey = async (surveyId: string): Promise<TSegment> => {
  validateInputs([surveyId, ZId]);

  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new ResourceNotFoundError("survey", surveyId);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // for this survey, does a private segment already exist
      const segment = await tx.segment.findFirst({
        where: {
          title: `${surveyId}`,
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

        surveyCache.revalidate({ id: surveyId });
        segmentCache.revalidate({ environmentId: survey.environmentId });

        return transformPrismaSegment(updatedSegment);
      } else {
        // This case should never happen because a private segment with the title of the surveyId
        // should always exist. But, handling it just in case.

        // if a private segment does not exist, create one
        const newPrivateSegment = await tx.segment.create({
          data: {
            title: `${surveyId}`,
            isPrivate: true,
            filters: [],
            surveys: { connect: { id: surveyId } },
            environment: { connect: { id: survey?.environmentId } },
          },
          select: selectSegment,
        });

        surveyCache.revalidate({ id: surveyId });
        segmentCache.revalidate({ environmentId: survey.environmentId });

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

const evaluateAttributeFilter = (
  attributes: TEvaluateSegmentUserAttributeData,
  filter: TSegmentAttributeFilter
): boolean => {
  const { value, qualifier, root } = filter;
  const { attributeClassName } = root;

  const attributeValue = attributes[attributeClassName];
  if (!attributeValue) {
    return false;
  }

  const attResult = compareValues(attributeValue, value, qualifier.operator);
  return attResult;
};

const evaluatePersonFilter = (userId: string, filter: TSegmentPersonFilter): boolean => {
  const { value, qualifier, root } = filter;
  const { personIdentifier } = root;

  if (personIdentifier === "userId") {
    const attResult = compareValues(userId, value, qualifier.operator);
    return attResult;
  }

  return false;
};

const getResolvedActionValue = async (actionClassId: string, personId: string, metric: TActionMetric) => {
  if (metric === "lastQuarterCount") {
    const lastQuarterCount = await getActionCountInLastQuarter(actionClassId, personId);
    return lastQuarterCount;
  }

  if (metric === "lastMonthCount") {
    const lastMonthCount = await getActionCountInLastMonth(actionClassId, personId);
    return lastMonthCount;
  }

  if (metric === "lastWeekCount") {
    const lastWeekCount = await getActionCountInLastWeek(actionClassId, personId);
    return lastWeekCount;
  }

  if (metric === "lastOccurranceDaysAgo") {
    const lastOccurranceDaysAgo = await getLastOccurrenceDaysAgo(actionClassId, personId);
    return lastOccurranceDaysAgo;
  }

  if (metric === "firstOccurranceDaysAgo") {
    const firstOccurranceDaysAgo = await getFirstOccurrenceDaysAgo(actionClassId, personId);
    return firstOccurranceDaysAgo;
  }

  if (metric === "occuranceCount") {
    const occuranceCount = await getTotalOccurrencesForAction(actionClassId, personId);
    return occuranceCount;
  }
};

const evaluateActionFilter = async (
  actionClassIds: string[],
  filter: TSegmentActionFilter,
  personId: string
): Promise<boolean> => {
  const { value, qualifier, root } = filter;
  const { actionClassId } = root;
  const { metric } = qualifier;

  // there could be a case when the actionIds do not have the actionClassId
  // in such a case, we return false

  const actionClassIdIndex = actionClassIds.findIndex((actionId) => actionId === actionClassId);
  if (actionClassIdIndex === -1) {
    return false;
  }

  try {
    // we have the action metric and we'll need to find out the values for those metrics from the db
    const actionValue = await getResolvedActionValue(actionClassId, personId, metric);

    const actionResult =
      actionValue !== undefined && compareValues(actionValue ?? 0, value, qualifier.operator);

    return actionResult;
  } catch (error) {
    throw error;
  }
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
  return compareValues(device, value, qualifier.operator);
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
  let resultPairs: ResultConnectorPair[] = [];

  try {
    for (let filterItem of filters) {
      const { resource } = filterItem;

      let result: boolean;

      if (isResourceFilter(resource)) {
        const { root } = resource;
        const { type } = root;

        if (type === "attribute") {
          result = evaluateAttributeFilter(userData.attributes, resource as TSegmentAttributeFilter);
          resultPairs.push({
            result,
            connector: filterItem.connector,
          });
        }

        if (type === "person") {
          result = evaluatePersonFilter(userData.userId, resource as TSegmentPersonFilter);
          resultPairs.push({
            result,
            connector: filterItem.connector,
          });
        }

        if (type === "action") {
          result = await evaluateActionFilter(
            userData.actionIds,
            resource as TSegmentActionFilter,
            userData.personId
          );

          resultPairs.push({
            result,
            connector: filterItem.connector,
          });
        }

        if (type === "segment") {
          result = await evaluateSegmentFilter(userData, resource as TSegmentSegmentFilter);
          resultPairs.push({
            result,
            connector: filterItem.connector,
          });
        }

        if (type === "device") {
          result = evaluateDeviceFilter(userData.deviceType, resource as TSegmentDeviceFilter);
          resultPairs.push({
            result,
            connector: filterItem.connector,
          });
        }
      } else {
        result = await evaluateSegment(userData, resource);

        // this is a sub-group and we need to evaluate the sub-group
        resultPairs.push({
          result,
          connector: filterItem.connector,
        });
      }
    }

    if (!resultPairs.length) {
      return false;
    }

    // Given that the first filter in every group/sub-group always has a connector value of "null",
    // we initialize the finalResult with the result of the first filter.

    let finalResult = resultPairs[0].result;

    for (let i = 1; i < resultPairs.length; i++) {
      const { result, connector } = resultPairs[i];

      if (connector === "and") {
        finalResult = finalResult && result;
      } else if (connector === "or") {
        finalResult = finalResult || result;
      }
    }

    return finalResult;
  } catch (error) {
    throw error;
  }
};

// This function is used to check if the environment has a segment that uses actions
export const getHasEnvironmentActionSegment = reactCache(
  (environmentId: string): Promise<boolean> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);
        const segments = await getSegments(environmentId);

        if (!segments || !segments.length) {
          return false;
        }

        let hasEnvironmentActionSegment = false;

        for (let segment of segments) {
          const hasActionFilter = JSON.stringify(segment.filters).includes(`"type":"action"`);
          if (hasActionFilter) {
            hasEnvironmentActionSegment = true;
            break;
          }
        }

        return hasEnvironmentActionSegment;
      },
      [`getHasActionSegment-${environmentId}`],
      {
        tags: [segmentCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);
