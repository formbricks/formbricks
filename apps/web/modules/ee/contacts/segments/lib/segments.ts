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
  TSegmentUpdateInput,
  TSegmentWithSurveyNames,
  ZRelativeDateValue,
  ZSegmentCreateInput,
  ZSegmentFilters,
  ZSegmentUpdateInput,
} from "@formbricks/types/segment";
import { getSurvey } from "@/lib/survey/service";
import { validateInputs } from "@/lib/utils/validate";
import { isResourceFilter, searchForAttributeKeyInSegment } from "@/modules/ee/contacts/segments/lib/utils";
import { isSameDay, subtractTimeUnit } from "./date-utils";

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

export const transformPrismaSegment = (segment: PrismaSegment): TSegmentWithSurveyNames => {
  const activeSurveys = segment.surveys
    .filter((survey) => survey.status === "inProgress")
    .map((survey) => survey.name);

  const inactiveSurveys = segment.surveys
    .filter((survey) => survey.status !== "inProgress")
    .map((survey) => survey.name);

  return {
    ...segment,
    surveys: segment.surveys.map((survey) => survey.id),
    activeSurveys,
    inactiveSurveys,
  };
};

export const getSegment = reactCache(async (segmentId: string): Promise<TSegmentWithSurveyNames> => {
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

export const getSegments = reactCache(async (environmentId: string): Promise<TSegmentWithSurveyNames[]> => {
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
});

export const createSegment = async (segmentCreateInput: TSegmentCreateInput): Promise<TSegment> => {
  validateInputs([segmentCreateInput, ZSegmentCreateInput]);

  const { description, environmentId, filters, isPrivate, surveyId, title } = segmentCreateInput;

  const surveyConnect = surveyId ? { surveys: { connect: { id: surveyId } } } : {};

  try {
    // Private segments use upsert because auto-save may have already created a
    // default (empty-filter) segment via connectOrCreate before the user publishes.
    // Without upsert the second create hits the (environmentId, title) unique constraint.
    if (isPrivate) {
      const segment = await prisma.segment.upsert({
        where: {
          environmentId_title: {
            environmentId,
            title,
          },
        },
        create: {
          environmentId,
          title,
          description,
          isPrivate,
          filters,
          ...surveyConnect,
        },
        update: {
          description,
          filters,
          ...surveyConnect,
        },
        select: selectSegment,
      });

      return transformPrismaSegment(segment);
    }

    const segment = await prisma.segment.create({
      data: {
        environmentId,
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

    return transformPrismaSegment(segment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getSegmentsByAttributeKey = reactCache(async (environmentId: string, attributeKey: string) => {
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
