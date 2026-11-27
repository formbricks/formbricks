import { logger } from "@formbricks/logger";
import {
  DATE_OPERATORS,
  TAllOperators,
  TBaseFilters,
  TDateOperator,
  TEvaluateSegmentUserAttributeData,
  TEvaluateSegmentUserData,
  TSegmentAttributeFilter,
  TSegmentConnector,
  TSegmentDeviceFilter,
  TSegmentFilterValue,
  TSegmentPersonFilter,
  TSegmentSegmentFilter,
  TSegmentSurveyInteractionFilter,
  ZRelativeDateValue,
  ZSegmentFilters,
} from "@formbricks/types/segment";
import { isResourceFilter } from "@/modules/ee/contacts/segments/lib/utils";
import { isSameDay, subtractTimeUnit } from "./date-utils";
import { combineFilterResults, evaluateSurveyInteractionFilterInMemory } from "./filter/survey-interaction";
import { getSegment } from "./segments";

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
