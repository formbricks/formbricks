import { createId } from "@paralleldrive/cuid2";

import {
  TActionMetric,
  TAllOperators,
  TAttributeOperator,
  TBaseFilterGroup,
  TBaseFilterGroupItem,
  TDeviceOperator,
  TSegmentOperator,
  TUserSegment,
  TUserSegmentActionFilter,
  TUserSegmentAttributeFilter,
  TUserSegmentConnector,
  TUserSegmentDeviceFilter,
  TUserSegmentFilter,
  TUserSegmentSegmentFilter,
} from "@formbricks/types/userSegment";

// type guard to check if a resource is a filter
export const isResourceFilter = (
  resource: TUserSegmentFilter | TBaseFilterGroup
): resource is TUserSegmentFilter => {
  return (resource as TUserSegmentFilter).root !== undefined;
};

export const convertOperatorToText = (operator: TAllOperators) => {
  switch (operator) {
    case "equals":
      return "=";
    case "notEquals":
      return "!=";
    case "lessThan":
      return "<";
    case "lessEqual":
      return "<=";
    case "greaterThan":
      return ">";
    case "greaterEqual":
      return ">=";
    case "isSet":
      return "is set";
    case "contains":
      return "contains ";
    case "doesNotContain":
      return "does not contain";
    case "startsWith":
      return "starts with";
    case "endsWith":
      return "ends with";
    case "userIsIn":
      return "User is in";
    case "userIsNotIn":
      return "User is not in";
    default:
      return operator;
  }
};

export const convertOperatorToTitle = (operator: TAllOperators) => {
  switch (operator) {
    case "equals":
      return "Equals";
    case "notEquals":
      return "Not equals to";
    case "lessThan":
      return "Less than";
    case "lessEqual":
      return "Less than or equal to";
    case "greaterThan":
      return "Greater than";
    case "greaterEqual":
      return "Greater than or equal to";
    case "isSet":
      return "Is set";
    case "contains":
      return "Contains";
    case "doesNotContain":
      return "Does not contain";
    case "startsWith":
      return "Starts with";
    case "endsWith":
      return "Ends with";
    case "userIsIn":
      return "User is in";
    case "userIsNotIn":
      return "User is not in";
    default:
      return operator;
  }
};

export const convertMetricToText = (metric: TActionMetric) => {
  switch (metric) {
    case "lastQuarterCount":
      return "Last quarter (Count)";
    case "lastMonthCount":
      return "Last month (Count)";
    case "lastWeekCount":
      return "Last week (Count)";
    case "occuranceCount":
      return "Occurance (Count)";
    case "lastOccurranceDaysAgo":
      return "Last occurrance (Days ago)";
    case "firstOccurranceDaysAgo":
      return "First occurrance (Days ago)";
    default:
      return metric;
  }
};

export const addFilterBelow = (group: TBaseFilterGroup, resourceId: string, filter: TBaseFilterGroupItem) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (isResourceFilter(resource)) {
      if (resource.id === resourceId) {
        group.splice(i + 1, 0, filter);
        break;
      }
    } else {
      if (group[i].id === resourceId) {
        group.splice(i + 1, 0, filter);
        break;
      } else {
        addFilterBelow(resource, resourceId, filter);
      }
    }
  }
};

export const createGroupFromResource = (group: TBaseFilterGroup, resourceId: string) => {
  for (let i = 0; i < group.length; i++) {
    const filterGroup = group[i];
    if (isResourceFilter(filterGroup.resource)) {
      if (filterGroup.resource.id === resourceId) {
        const newGroupToAdd: TBaseFilterGroupItem = {
          id: createId(),
          connector: filterGroup.connector,
          resource: [
            {
              ...filterGroup,
              connector: null,
            },
          ],
        };

        group.splice(i, 1, newGroupToAdd);

        break;
      }
    } else {
      if (group[i].id === resourceId) {
        // make an outer group, wrap the current group in it and add a filter below it

        const newFilter: TBaseFilterGroupItem = {
          id: createId(),
          connector: "and",
          resource: {
            id: createId(),
            root: { type: "attribute", attributeClassName: "" },
            qualifier: { operator: "endsWith" },
            value: "",
          },
        };

        const outerGroup: TBaseFilterGroupItem = {
          connector: filterGroup.connector,
          id: createId(),
          resource: [{ ...filterGroup, connector: null }, newFilter],
        };

        group.splice(i, 1, outerGroup);

        break;
      } else {
        createGroupFromResource(filterGroup.resource, resourceId);
      }
    }
  }
};

export const moveResourceUp = (group: TBaseFilterGroup, i: number) => {
  if (i === 0) {
    return;
  }

  const previousTemp = group[i - 1];

  group[i - 1] = group[i];
  group[i] = previousTemp;

  if (i - 1 === 0) {
    const newConnector = group[i - 1].connector;

    group[i - 1].connector = null;
    group[i].connector = newConnector;
  }
};

export const moveResourceDown = (group: TBaseFilterGroup, i: number) => {
  if (i === group.length - 1) {
    return;
  }

  const temp = group[i + 1];
  group[i + 1] = group[i];
  group[i] = temp;

  // after the swap, determine if the connector should be null or not
  if (i === 0) {
    const nextConnector = group[i].connector;

    group[i].connector = null;
    group[i + 1].connector = nextConnector;
  }
};

export const moveResource = (group: TBaseFilterGroup, resourceId: string, direction: "up" | "down") => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (isResourceFilter(resource)) {
      if (resource.id === resourceId) {
        if (direction === "up") {
          moveResourceUp(group, i);
          break;
        } else {
          moveResourceDown(group, i);
          break;
        }
      }
    } else {
      if (group[i].id === resourceId) {
        if (direction === "up") {
          moveResourceUp(group, i);
          break;
        } else {
          moveResourceDown(group, i);
          break;
        }
      }

      moveResource(resource, resourceId, direction);
    }
  }
};

export const deleteResource = (group: TBaseFilterGroup, resourceId: string) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (isResourceFilter(resource) && resource.id === resourceId) {
      group.splice(i, 1);

      if (group.length) {
        group[0].connector = null;
      }

      break;
    } else if (!isResourceFilter(resource) && group[i].id === resourceId) {
      group.splice(i, 1);

      if (group.length) {
        group[0].connector = null;
      }

      break;
    } else if (!isResourceFilter(resource)) {
      deleteResource(resource, resourceId);
    }
  }
};

export const deleteEmptyGroups = (group: TBaseFilterGroup) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (!isResourceFilter(resource) && resource.length === 0) {
      group.splice(i, 1);
    } else if (!isResourceFilter(resource)) {
      deleteEmptyGroups(resource);
    }
  }
};

export const addFilterInGroup = (group: TBaseFilterGroup, groupId: string, filter: TBaseFilterGroupItem) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (isResourceFilter(resource)) {
      continue;
    } else {
      if (group[i].id === groupId) {
        const { resource } = group[i];

        if (!isResourceFilter(resource)) {
          if (resource.length === 0) {
            resource.push({
              ...filter,
              connector: null,
            });
          } else {
            resource.push(filter);
          }
        }

        break;
      } else {
        addFilterInGroup(resource, groupId, filter);
      }
    }
  }
};

export const toggleGroupConnector = (
  group: TBaseFilterGroup,
  groupId: string,
  newConnectorValue: TUserSegmentConnector
) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];
    if (!isResourceFilter(resource)) {
      if (group[i].id === groupId) {
        group[i].connector = newConnectorValue;
        break;
      } else {
        toggleGroupConnector(resource, groupId, newConnectorValue);
      }
    }
  }
};

export const toggleFilterConnector = (
  group: TBaseFilterGroup,
  filterId: string,
  newConnectorValue: TUserSegmentConnector
) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (isResourceFilter(resource)) {
      if (resource.id === filterId) {
        group[i].connector = newConnectorValue;
      }
    } else {
      toggleFilterConnector(resource, filterId, newConnectorValue);
    }
  }
};

export const updateOperatorInFilter = (
  group: TBaseFilterGroup,
  filterId: string,
  newOperator: TAttributeOperator | TSegmentOperator | TDeviceOperator
) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (isResourceFilter(resource)) {
      if (resource.id === filterId) {
        resource.qualifier.operator = newOperator;
        break;
      }
    } else {
      updateOperatorInFilter(resource, filterId, newOperator);
    }
  }
};

export const updateAttributeClassNameInFilter = (
  group: TBaseFilterGroup,
  filterId: string,
  newAttributeClassName: string
) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (isResourceFilter(resource)) {
      if (resource.id === filterId) {
        (resource as TUserSegmentAttributeFilter).root.attributeClassName = newAttributeClassName;
        break;
      }
    } else {
      updateAttributeClassNameInFilter(resource, filterId, newAttributeClassName);
    }
  }
};

export const updateActionClassIdInFilter = (
  group: TBaseFilterGroup,
  filterId: string,
  newActionClassId: string
) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (isResourceFilter(resource)) {
      if (resource.id === filterId) {
        (resource as TUserSegmentActionFilter).root.actionClassId = newActionClassId;
        break;
      }
    } else {
      updateActionClassIdInFilter(resource, filterId, newActionClassId);
    }
  }
};

export const updateMetricInFilter = (group: TBaseFilterGroup, filterId: string, newMetric: TActionMetric) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (isResourceFilter(resource)) {
      if (resource.id === filterId) {
        (resource as TUserSegmentActionFilter).qualifier.metric = newMetric;
        break;
      }
    } else {
      updateMetricInFilter(resource, filterId, newMetric);
    }
  }
};

export const updateSegmentIdInFilter = (group: TBaseFilterGroup, filterId: string, newSegmentId: string) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (isResourceFilter(resource)) {
      if (resource.id === filterId) {
        (resource as TUserSegmentSegmentFilter).root.userSegmentId = newSegmentId;
        resource.value = newSegmentId;
        break;
      }
    } else {
      updateSegmentIdInFilter(resource, filterId, newSegmentId);
    }
  }
};

export const updateFilterValue = (group: TBaseFilterGroup, filterId: string, newValue: string | number) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (isResourceFilter(resource)) {
      if (resource.id === filterId) {
        resource.value = newValue;

        break;
      }
    } else {
      updateFilterValue(resource, filterId, newValue);
    }
  }
};

export const updateDeviceTypeInFilter = (
  group: TBaseFilterGroup,
  filterId: string,
  newDeviceType: "phone" | "desktop"
) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (isResourceFilter(resource)) {
      if (resource.id === filterId) {
        (resource as TUserSegmentDeviceFilter).root.deviceType = newDeviceType;
        resource.value = newDeviceType;
        break;
      }
    } else {
      updateDeviceTypeInFilter(resource, filterId, newDeviceType);
    }
  }
};

export const formatUserSegmentDateFields = (userSegment: TUserSegment): TUserSegment => {
  if (typeof userSegment.createdAt === "string") {
    userSegment.createdAt = new Date(userSegment.createdAt);
  }

  if (typeof userSegment.updatedAt === "string") {
    userSegment.updatedAt = new Date(userSegment.updatedAt);
  }

  return userSegment;
};
