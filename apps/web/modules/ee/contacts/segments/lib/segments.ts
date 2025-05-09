import { cache } from "@/lib/cache";
import { segmentCache } from "@/lib/cache/segment";
import { surveyCache } from "@/lib/survey/cache";
import { getSurvey } from "@/lib/survey/service";
import { validateInputs } from "@/lib/utils/validate";
import { isResourceFilter, searchForAttributeKeyInSegment } from "@/modules/ee/contacts/segments/lib/utils";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId, ZString } from "@formbricks/types/common";
import {
  DatabaseError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import {
  TAllOperators,
  TBaseFilters,
  TEvaluateSegmentUserAttributeData,
  TEvaluateSegmentUserData,
  TSegment,
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

export type PrismaSegment = Prisma.SegmentGetPayload<{
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
} satisfies Prisma.SegmentSelect;

export const transformPrismaSegment = (segment: PrismaSegment): TSegment => {
  return {
    ...segment,
    surveys: segment.surveys.map((survey) => survey.id),
  };
};

export const getSegment = reactCache(
  async (segmentId: string): Promise<TSegment> =>
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
    segment.surveys.forEach((survey) => surveyCache.revalidate({ id: survey.id }));

    surveyCache.revalidate({ environmentId: currentSegment.environmentId });

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
    segment.surveys.forEach((survey) => surveyCache.revalidate({ id: survey.id }));

    return transformPrismaSegment(segment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getSegmentsByAttributeKey = reactCache((environmentId: string, attributeKey: string) =>
  cache(
    async () => {
      validateInputs([environmentId, ZId], [attributeKey, ZString]);

      try {
        const segments = await prisma.segment.findMany({
          where: {
            environmentId,
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
    },
    [`getSegmentsByAttributeKey-${environmentId}-${attributeKey}`],
    {
      tags: [segmentCache.tag.byEnvironmentId(environmentId), segmentCache.tag.byAttributeKey(attributeKey)],
    }
  )()
);

const evaluateAttributeFilter = (
  attributes: TEvaluateSegmentUserAttributeData,
  filter: TSegmentAttributeFilter
): boolean => {
  const { value, qualifier, root } = filter;
  const { contactAttributeKey } = root;

  const attributeValue = attributes[contactAttributeKey];
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
  if (!filters.length) {
    // if there are no filters, the segment will be evaluated as true
    return true;
  }

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

    // We first evaluate all `and` conditions consecutively
    let intermediateResults: boolean[] = [];

    // Given that the first filter in every group/sub-group always has a connector value of "null",
    // we initialize the finalResult with the result of the first filter.
    let currentAndGroupResult = resultPairs[0].result;

    for (let i = 1; i < resultPairs.length; i++) {
      const { result, connector } = resultPairs[i];

      if (connector === "and") {
        currentAndGroupResult = currentAndGroupResult && result;
      } else if (connector === "or") {
        intermediateResults.push(currentAndGroupResult);
        currentAndGroupResult = result;
      }
    }
    // Push the final `and` group result
    intermediateResults.push(currentAndGroupResult);

    // Now we can evaluate the `or` conditions
    let finalResult = intermediateResults[0];
    for (let i = 1; i < intermediateResults.length; i++) {
      finalResult = finalResult || intermediateResults[i];
    }

    return finalResult;
  } catch (error) {
    logger.error("Error evaluating segment", error);

    throw error;
  }
};
