import { createId } from "@paralleldrive/cuid2";
import { InvalidInputError } from "@formbricks/types/errors";
import {
  TAllOperators,
  TAttributeOperator,
  TBaseFilter,
  TBaseFilters,
  TDeviceOperator,
  TSegment,
  TSegmentAttributeFilter,
  TSegmentConnector,
  TSegmentDeviceFilter,
  TSegmentFilter,
  TSegmentOperator,
  TSegmentPersonFilter,
  TSegmentSegmentFilter,
} from "@formbricks/types/segment";

// type guard to check if a resource is a filter
export const isResourceFilter = (resource: TSegmentFilter | TBaseFilters): resource is TSegmentFilter => {
  return (resource as TSegmentFilter).root !== undefined;
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
    case "isNotSet":
      return "is not set";
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
    case "isNotSet":
      return "Is not set";
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

export const addFilterBelow = (group: TBaseFilters, resourceId: string, filter: TBaseFilter) => {
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

export const createGroupFromResource = (group: TBaseFilters, resourceId: string) => {
  for (let i = 0; i < group.length; i++) {
    const filters = group[i];
    if (isResourceFilter(filters.resource)) {
      if (filters.resource.id === resourceId) {
        const newGroupToAdd: TBaseFilter = {
          id: createId(),
          connector: filters.connector,
          resource: [
            {
              ...filters,
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

        const outerGroup: TBaseFilter = {
          connector: filters.connector,
          id: createId(),
          resource: [{ ...filters, connector: null }],
        };

        group.splice(i, 1, outerGroup);

        break;
      } else {
        createGroupFromResource(filters.resource, resourceId);
      }
    }
  }
};

export const moveResourceUp = (group: TBaseFilters, i: number) => {
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

export const moveResourceDown = (group: TBaseFilters, i: number) => {
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

export const moveResource = (group: TBaseFilters, resourceId: string, direction: "up" | "down") => {
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

export const deleteResource = (group: TBaseFilters, resourceId: string) => {
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

  // check and delete all empty groups
  deleteEmptyGroups(group);
};

export const deleteEmptyGroups = (group: TBaseFilters) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (!isResourceFilter(resource) && resource.length === 0) {
      group.splice(i, 1);
    } else if (!isResourceFilter(resource)) {
      deleteEmptyGroups(resource);
    }
  }
};

export const addFilterInGroup = (group: TBaseFilters, groupId: string, filter: TBaseFilter) => {
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
  group: TBaseFilters,
  groupId: string,
  newConnectorValue: TSegmentConnector
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
  group: TBaseFilters,
  filterId: string,
  newConnectorValue: TSegmentConnector
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
  group: TBaseFilters,
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

export const updateContactAttributeKeyInFilter = (
  group: TBaseFilters,
  filterId: string,
  newContactAttributeKey: string
) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (isResourceFilter(resource)) {
      if (resource.id === filterId) {
        (resource as TSegmentAttributeFilter).root.contactAttributeKey = newContactAttributeKey;
        break;
      }
    } else {
      updateContactAttributeKeyInFilter(resource, filterId, newContactAttributeKey);
    }
  }
};

export const updatePersonIdentifierInFilter = (
  group: TBaseFilters,
  filterId: string,
  newPersonIdentifier: string
) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (isResourceFilter(resource)) {
      if (resource.id === filterId) {
        (resource as TSegmentPersonFilter).root.personIdentifier = newPersonIdentifier;
      }
    } else {
      updatePersonIdentifierInFilter(resource, filterId, newPersonIdentifier);
    }
  }
};

export const updateSegmentIdInFilter = (group: TBaseFilters, filterId: string, newSegmentId: string) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (isResourceFilter(resource)) {
      if (resource.id === filterId) {
        (resource as TSegmentSegmentFilter).root.segmentId = newSegmentId;
        resource.value = newSegmentId;
        break;
      }
    } else {
      updateSegmentIdInFilter(resource, filterId, newSegmentId);
    }
  }
};

export const updateFilterValue = (group: TBaseFilters, filterId: string, newValue: string | number) => {
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
  group: TBaseFilters,
  filterId: string,
  newDeviceType: "phone" | "desktop"
) => {
  for (let i = 0; i < group.length; i++) {
    const { resource } = group[i];

    if (isResourceFilter(resource)) {
      if (resource.id === filterId) {
        (resource as TSegmentDeviceFilter).root.deviceType = newDeviceType;
        resource.value = newDeviceType;
        break;
      }
    } else {
      updateDeviceTypeInFilter(resource, filterId, newDeviceType);
    }
  }
};

export const formatSegmentDateFields = (segment: TSegment): TSegment => {
  if (typeof segment.createdAt === "string") {
    segment.createdAt = new Date(segment.createdAt);
  }

  if (typeof segment.updatedAt === "string") {
    segment.updatedAt = new Date(segment.updatedAt);
  }

  return segment;
};

export const searchForAttributeKeyInSegment = (filters: TBaseFilters, attributeKey: string): boolean => {
  for (let filter of filters) {
    const { resource } = filter;

    if (isResourceFilter(resource)) {
      const { root } = resource;
      const { type } = root;

      if (type === "attribute") {
        const { contactAttributeKey: key } = root;
        if (key === attributeKey) {
          return true;
        }
      }
    } else {
      const found = searchForAttributeKeyInSegment(resource, attributeKey);
      if (found) {
        return true;
      }
    }
  }

  return false;
};

// check if a segment has a filter with "type" other than "attribute" or "person"
// if it does, this is an advanced segment
export const isAdvancedSegment = (filters: TBaseFilters): boolean => {
  for (let filter of filters) {
    const { resource } = filter;

    if (isResourceFilter(resource)) {
      const { root } = resource;
      const { type } = root;

      if (type !== "attribute" && type !== "person") {
        return true;
      }
    } else {
      // the resource is a group, so we don't need to recurse, we know that this is an advanced segment
      return true;
    }
  }

  return false;
};

/**
 * Checks if a segment filter contains a recursive reference to itself
 * @param filters - The filters to check for recursive references
 * @param segmentId - The ID of the segment being checked
 * @throws {InvalidInputError} When a recursive segment filter is detected
 */
export const checkForRecursiveSegmentFilter = (filters: TBaseFilters, segmentId: string) => {
  for (const filter of filters) {
    const { resource } = filter;
    if (isResourceFilter(resource)) {
      if (resource.root.type === "segment") {
        if (resource.value === segmentId) {
          throw new InvalidInputError("Recursive segment filter is not allowed");
        }
      }
    } else {
      checkForRecursiveSegmentFilter(resource, segmentId);
    }
  }
};
