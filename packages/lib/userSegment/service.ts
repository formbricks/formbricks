import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import {
  TActionMetric,
  TAllOperators,
  TBaseFilters,
  TEvaluateSegmentUserAttributeData,
  TEvaluateSegmentUserData,
  TUserSegment,
  TUserSegmentActionFilter,
  TUserSegmentAttributeFilter,
  TUserSegmentConnector,
  TUserSegmentCreateInput,
  TUserSegmentDeviceFilter,
  TUserSegmentPersonFilter,
  TUserSegmentSegmentFilter,
  TUserSegmentUpdateInput,
  ZUserSegmentCreateInput,
  ZUserSegmentFilters,
  ZUserSegmentUpdateInput,
} from "@formbricks/types/userSegment";

import {
  getActionCountInLastMonth,
  getActionCountInLastQuarter,
  getActionCountInLastWeek,
  getFirstOccurrenceDaysAgo,
  getLastOccurrenceDaysAgo,
  getTotalOccurrencesForAction,
} from "../action/service";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { surveyCache } from "../survey/cache";
import { validateInputs } from "../utils/validate";
import { userSegmentCache } from "./cache";
import { isResourceFilter, searchForAttributeClassNameInUserSegment } from "./utils";

type PrismaUserSegment = Prisma.UserSegmentGetPayload<{
  include: {
    surveys: {
      select: {
        id: true;
      };
    };
  };
}>;

export const selectUserSegment: Prisma.UserSegmentDefaultArgs["select"] = {
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
    },
  },
};

export const transformPrismaUserSegment = (userSegment: PrismaUserSegment): TUserSegment => {
  return {
    ...userSegment,
    surveys: userSegment.surveys.map((survey) => survey.id),
  };
};

export const createUserSegment = async (
  userSegmentCreateInput: TUserSegmentCreateInput
): Promise<TUserSegment> => {
  validateInputs([userSegmentCreateInput, ZUserSegmentCreateInput]);

  const { description, environmentId, filters, isPrivate, surveyId, title } = userSegmentCreateInput;
  try {
    const userSegment = await prisma.userSegment.create({
      data: {
        environmentId,
        title,
        description,
        isPrivate,
        filters,
        ...(surveyId && {
          surveys: {
            connect: {
              id: surveyId,
            },
          },
        }),
      },
      select: selectUserSegment,
    });

    userSegmentCache.revalidate({ id: userSegment.id, environmentId });

    return transformPrismaUserSegment(userSegment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getUserSegments = async (environmentId: string): Promise<TUserSegment[]> => {
  validateInputs([environmentId, ZId]);

  const userSegments = await unstable_cache(
    async () => {
      try {
        const userSegments = await prisma.userSegment.findMany({
          where: {
            environmentId,
          },
          select: selectUserSegment,
        });

        if (!userSegments) {
          return [];
        }

        return userSegments.map((userSegment) => transformPrismaUserSegment(userSegment));
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getUserSegments-${environmentId}`],
    {
      tags: [userSegmentCache.tag.byEnvironmentId(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return userSegments;
};

export const getUserSegment = async (userSegmentId: string): Promise<TUserSegment> => {
  validateInputs([userSegmentId, ZId]);

  const userSegment = await unstable_cache(
    async () => {
      try {
        const userSegment = await prisma.userSegment.findUnique({
          where: {
            id: userSegmentId,
          },
          select: selectUserSegment,
        });

        if (!userSegment) {
          throw new ResourceNotFoundError("userSegment", userSegmentId);
        }

        return transformPrismaUserSegment(userSegment);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getUserSegment-${userSegmentId}`],
    {
      tags: [userSegmentCache.tag.byId(userSegmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return userSegment;
};

export const updateUserSegment = async (
  userSegmentId: string,
  data: TUserSegmentUpdateInput
): Promise<TUserSegment> => {
  validateInputs([userSegmentId, ZId], [data, ZUserSegmentUpdateInput]);

  try {
    let updatedInput: Prisma.UserSegmentUpdateInput = {
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

    const currentUserSegment = await getUserSegment(userSegmentId);
    if (!currentUserSegment) {
      throw new ResourceNotFoundError("userSegment", userSegmentId);
    }

    const userSegment = await prisma.userSegment.update({
      where: {
        id: userSegmentId,
      },
      data: updatedInput,
      select: selectUserSegment,
    });

    userSegmentCache.revalidate({ id: userSegmentId, environmentId: userSegment.environmentId });
    userSegment.surveys.map((survey) => surveyCache.revalidate({ id: survey.id }));

    return transformPrismaUserSegment(userSegment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getUserSegmentActiveInactiveSurveys = async (
  userSegmentId: string
): Promise<{
  activeSurveys: string[];
  inactiveSurveys: string[];
}> => {
  const surveys = await unstable_cache(
    async () => {
      try {
        const activeSurveysData = await prisma.userSegment.findUnique({
          where: {
            id: userSegmentId,
            surveys: {
              every: {
                status: "inProgress",
              },
            },
          },
          select: {
            surveys: {
              select: { name: true },
            },
          },
        });

        const inactiveSurveysData = await prisma.userSegment.findUnique({
          where: {
            id: userSegmentId,
            surveys: {
              every: {
                status: {
                  in: ["paused", "completed"],
                },
              },
            },
          },
          select: {
            surveys: {
              select: { name: true },
            },
          },
        });

        const activeSurveys = activeSurveysData?.surveys.map((survey) => survey.name);
        const inactiveSurveys = inactiveSurveysData?.surveys.map((survey) => survey.name);

        return {
          activeSurveys: activeSurveys ?? [],
          inactiveSurveys: inactiveSurveys ?? [],
        };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getUserSegmentActiveInactiveSurveys-${userSegmentId}`],
    {
      tags: [userSegmentCache.tag.byId(userSegmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return surveys;
};

export const deleteUserSegment = async (segmentId: string): Promise<TUserSegment> => {
  try {
    const currentUserSegment = await getUserSegment(segmentId);
    if (!currentUserSegment) {
      throw new ResourceNotFoundError("userSegment", segmentId);
    }

    const segment = await prisma.userSegment.delete({
      where: {
        id: segmentId,
      },
      select: selectUserSegment,
    });

    userSegmentCache.revalidate({ id: segmentId, environmentId: segment.environmentId });
    segment.surveys.map((survey) => surveyCache.revalidate({ id: survey.id }));

    return transformPrismaUserSegment(segment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const cloneUserSegment = async (userSegmentId: string, surveyId: string): Promise<TUserSegment> => {
  try {
    const userSegment = await getUserSegment(userSegmentId);
    if (!userSegment) {
      throw new ResourceNotFoundError("userSegment", userSegmentId);
    }

    const clonedUserSegment = await prisma.userSegment.create({
      data: {
        title: `Copy of ${userSegment.title}`,
        description: userSegment.description,
        isPrivate: userSegment.isPrivate,
        environmentId: userSegment.environmentId,
        surveys: {
          connect: {
            id: surveyId,
          },
        },
      },
      select: selectUserSegment,
    });

    if (clonedUserSegment.id) {
      // parse the filters and update the user segment
      const parsedFilters = ZUserSegmentFilters.safeParse(userSegment.filters);
      if (!parsedFilters.success) {
        throw new ValidationError("Invalid filters");
      }

      clonedUserSegment.filters = parsedFilters.data;
    }

    userSegmentCache.revalidate({ id: clonedUserSegment.id, environmentId: clonedUserSegment.environmentId });
    surveyCache.revalidate({ id: surveyId });

    return transformPrismaUserSegment(clonedUserSegment);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getUserSegmentsByAttributeClassName = async (
  environmentId: string,
  attributeClassName: string
) => {
  const segments = await unstable_cache(
    async () => {
      try {
        const userSegments = await prisma.userSegment.findMany({
          where: {
            environmentId,
          },
          select: selectUserSegment,
        });

        // search for attributeClassName in the filters
        const clonedUserSegments = structuredClone(userSegments);

        const filteredUserSegments = clonedUserSegments.filter((userSegment) => {
          return searchForAttributeClassNameInUserSegment(userSegment.filters, attributeClassName);
        });

        return filteredUserSegments;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getUserSegmentsByAttributeClassName-${environmentId}-${attributeClassName}`],
    {
      tags: [
        userSegmentCache.tag.byEnvironmentId(environmentId),
        userSegmentCache.tag.byAttributeClassName(attributeClassName),
      ],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return segments;
};

const evaluateAttributeFilter = (
  attributes: TEvaluateSegmentUserAttributeData,
  filter: TUserSegmentAttributeFilter
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

const evaluatePersonFilter = (userId: string, filter: TUserSegmentPersonFilter): boolean => {
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
  filter: TUserSegmentActionFilter,
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

  // we have the action metric and we'll need to find out the values for those metrics from the db
  const actionValue = await getResolvedActionValue(actionClassId, personId, metric);

  const actionResult =
    actionValue !== undefined && compareValues(actionValue ?? 0, value, qualifier.operator);

  return actionResult;
};

const evaluateSegmentFilter = async (
  userData: TEvaluateSegmentUserData,
  filter: TUserSegmentSegmentFilter
): Promise<boolean> => {
  const { qualifier, root } = filter;
  const { userSegmentId } = root;
  const { operator } = qualifier;

  const userSegment = await getUserSegment(userSegmentId);

  if (!userSegment) {
    return false;
  }

  const parsedFilters = ZUserSegmentFilters.safeParse(userSegment.filters);
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

const evaluateDeviceFilter = (device: "phone" | "desktop", filter: TUserSegmentDeviceFilter): boolean => {
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
  connector: TUserSegmentConnector;
};

export const evaluateSegment = async (
  userData: TEvaluateSegmentUserData,
  filters: TBaseFilters
): Promise<boolean> => {
  let resultPairs: ResultConnectorPair[] = [];

  for (let filterItem of filters) {
    const { resource } = filterItem;

    let result: boolean;

    if (isResourceFilter(resource)) {
      const { root } = resource;
      const { type } = root;

      if (type === "attribute") {
        result = evaluateAttributeFilter(userData.attributes, resource as TUserSegmentAttributeFilter);
        resultPairs.push({
          result,
          connector: filterItem.connector,
        });
      }

      if (type === "person") {
        result = evaluatePersonFilter(userData.userId, resource as TUserSegmentPersonFilter);
        resultPairs.push({
          result,
          connector: filterItem.connector,
        });
      }

      if (type === "action") {
        result = await evaluateActionFilter(
          userData.actionIds,
          resource as TUserSegmentActionFilter,
          userData.personId
        );

        resultPairs.push({
          result,
          connector: filterItem.connector,
        });
      }

      if (type === "segment") {
        result = await evaluateSegmentFilter(userData, resource as TUserSegmentSegmentFilter);
        resultPairs.push({
          result,
          connector: filterItem.connector,
        });
      }

      if (type === "device") {
        result = evaluateDeviceFilter(userData.deviceType, resource as TUserSegmentDeviceFilter);
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
};
