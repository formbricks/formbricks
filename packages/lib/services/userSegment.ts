import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TActionMetric,
  TAllOperators,
  TBaseFilterGroup,
  TUserSegment,
  TUserSegmentActionFilter,
  TUserSegmentAttributeFilter,
  TUserSegmentConnector,
  TUserSegmentDeviceFilter,
  TUserSegmentSegmentFilter,
  TUserSegmentUpdateInput,
  ZUserSegmentFilterGroup,
  isResourceFilter,
} from "@formbricks/types/userSegment";

import {
  getFirstOccurrenceDaysAgo,
  getLastMonthEventCount,
  getLastOccurrenceDaysAgo,
  getLastQuarterEventCount,
  getLastWeekEventCount,
  getTotalOccurrences,
} from "./actionsHelpers";

export const createUserSegment = async (
  environmentId: string,
  surveyId: string,
  title: string,
  description: string,
  isPrivate: boolean,
  filters: TBaseFilterGroup
): Promise<TUserSegment> => {
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
    include: {
      surveys: {
        select: {
          id: true,
        },
      },
    },
  });

  return {
    ...userSegment,
    surveys: userSegment.surveys.map((survey) => survey.id),
  };
};

export const getUserSegments = async (environmentId: string): Promise<TUserSegment[]> => {
  const userSegments = await prisma.userSegment.findMany({
    where: {
      environmentId,
    },
    include: {
      surveys: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!userSegments) {
    return [];
  }

  return userSegments.map((userSegment) => ({
    ...userSegment,
    surveys: userSegment.surveys.map((survey) => survey.id),
  }));
};

export const getUserSegment = async (userSegmentId: string): Promise<TUserSegment> => {
  const userSegment = await prisma.userSegment.findUnique({
    where: {
      id: userSegmentId,
    },
    include: {
      surveys: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!userSegment) {
    throw new ResourceNotFoundError("userSegment", userSegmentId);
  }

  return {
    ...userSegment,
    surveys: userSegment.surveys.map((survey) => survey.id),
  };
};

export const updateUserSegment = async (
  segmentId: string,
  data: TUserSegmentUpdateInput
): Promise<TUserSegment> => {
  const userSegment = await prisma.userSegment.update({
    where: {
      id: segmentId,
    },
    data,
    include: {
      surveys: {
        select: {
          id: true,
        },
      },
    },
  });

  return {
    ...userSegment,
    surveys: userSegment.surveys.map((survey) => survey.id),
  };
};

export const getUserSegmentActiveInactiveSurveys = async (
  userSegmentId: string
): Promise<{
  activeSurveys: string[];
  inactiveSurveys: string[];
}> => {
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
};

export const deleteUserSegment = async (segmentId: string) => {
  // unset the user segment from all the surveys

  await prisma.survey.updateMany({
    where: {
      userSegmentId: segmentId,
    },
    data: {
      userSegmentId: null,
    },
  });

  await prisma.userSegment.delete({
    where: {
      id: segmentId,
    },
  });
};

export const loadNewUserSegment = async (surveyId: string, newSegmentId: string) => {
  const userSegment = await prisma.userSegment.findUnique({
    where: {
      id: newSegmentId,
    },
    include: {
      surveys: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!userSegment) {
    throw new Error("User segment not found");
  }

  const updatedSurvey = await prisma.survey.update({
    where: {
      id: surveyId,
    },
    data: {
      userSegment: {
        connect: {
          id: newSegmentId,
        },
      },
    },
    include: {
      userSegment: {
        include: {
          surveys: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  return updatedSurvey;
};

export const cloneUserSegment = async (segmentId: string, surveyId: string): Promise<TUserSegment> => {
  const userSegment = await prisma.userSegment.findUnique({
    where: {
      id: segmentId,
    },
  });

  if (!userSegment) {
    throw new ResourceNotFoundError("userSegment", segmentId);
  }

  try {
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
      include: {
        surveys: { select: { id: true } },
      },
    });

    if (clonedUserSegment.id) {
      // parse the filters and update the user segment
      const parsedFilters = ZUserSegmentFilterGroup.safeParse(userSegment.filters);
      if (!parsedFilters.success) {
        throw new Error("Invalid filters");
      }

      clonedUserSegment.filters = parsedFilters.data;
    }

    return {
      ...clonedUserSegment,
      surveys: clonedUserSegment.surveys.map((survey) => survey.id),
    };
  } catch (err) {
    throw new DatabaseError("Error cloning user segment");
  }
};

type UserAttributeData = {
  [attributeClassId: string]: string | number;
};

type UserData = {
  personId: string;
  environmentId: string;
  attributes: UserAttributeData;
  actionIds: string[];
  deviceType: "phone" | "desktop";
};

const evaluateAttributeFilter = (
  attributes: UserAttributeData,
  filter: TUserSegmentAttributeFilter
): boolean => {
  const { value, qualifier, root } = filter;
  const { attributeClassId } = root;

  const attributeValue = attributes[attributeClassId];

  if (!attributeValue) {
    return false;
  }

  const attResult = compareValues(attributeValue, value, qualifier.operator);
  return attResult;
};

const getResolvedActionValue = async (
  actiondClassId: string,
  personId: string,
  environmentId: string,
  metric: TActionMetric
) => {
  if (metric === "lastQuarterCount") {
    const lastQuarterCount = await getLastQuarterEventCount(environmentId, personId, actiondClassId);
    return lastQuarterCount;
  }

  if (metric === "lastMonthCount") {
    const lastMonthCount = await getLastMonthEventCount(environmentId, personId, actiondClassId);
    return lastMonthCount;
  }

  if (metric === "lastWeekCount") {
    const lastWeekCount = await getLastWeekEventCount(environmentId, personId, actiondClassId);
    return lastWeekCount;
  }

  if (metric === "lastOccurranceDaysAgo") {
    const lastOccurranceDaysAgo = await getLastOccurrenceDaysAgo(environmentId, personId, actiondClassId);
    return lastOccurranceDaysAgo;
  }

  if (metric === "firstOccurranceDaysAgo") {
    const firstOccurranceDaysAgo = await getFirstOccurrenceDaysAgo(environmentId, personId, actiondClassId);
    return firstOccurranceDaysAgo;
  }

  if (metric === "occuranceCount") {
    const occuranceCount = await getTotalOccurrences(environmentId, personId, actiondClassId);
    return occuranceCount;
  }
};

const evaluateActionFilter = async (
  actionIds: string[],
  filter: TUserSegmentActionFilter,
  personId: string,
  environmentId: string
): Promise<boolean> => {
  const { value, qualifier, root } = filter;
  const { actionClassId } = root;
  const { metric } = qualifier;

  // there could be a case when the actionIds do not have the actionClassId
  // in such a case, we return false

  const actionClassIdIndex = actionIds.findIndex((actionId) => actionId === actionClassId);
  if (actionClassIdIndex === -1) {
    return false;
  }

  // we have the action metric and we'll need to find out the values for those metrics from the db

  const actionValue = await getResolvedActionValue(actionClassId, personId, environmentId, metric);

  const actionResult =
    actionValue !== undefined && compareValues(actionValue ?? 0, value, qualifier.operator);

  return actionResult;
};

const evaluateSegmentFilter = async (
  userData: UserData,
  filter: TUserSegmentSegmentFilter
): Promise<boolean> => {
  const { qualifier, root } = filter;
  const { userSegmentId } = root;
  const { operator } = qualifier;

  const userSegment = await getUserSegment(userSegmentId);

  if (!userSegment) {
    return false;
  }

  const parsedFilters = ZUserSegmentFilterGroup.safeParse(userSegment.filters);
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

export async function evaluateSegment(userData: UserData, filterGroup: TBaseFilterGroup): Promise<boolean> {
  let resultPairs: ResultConnectorPair[] = [];

  for (let filterItem of filterGroup) {
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

      if (type === "action") {
        result = await evaluateActionFilter(
          userData.actionIds,
          resource as TUserSegmentActionFilter,
          userData.personId,
          userData.environmentId
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
}
