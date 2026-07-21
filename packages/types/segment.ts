import { z } from "zod";
import { ZId } from "./common";

// The segment filter has operators, these are all the types of operators that can be used
export const BASE_OPERATORS = [
  "lessThan",
  "lessEqual",
  "greaterThan",
  "greaterEqual",
  "equals",
  "notEquals",
] as const;
export const ARITHMETIC_OPERATORS = ["lessThan", "lessEqual", "greaterThan", "greaterEqual"] as const;
export type TArithmeticOperator = (typeof ARITHMETIC_OPERATORS)[number];
export const STRING_OPERATORS = ["contains", "doesNotContain", "startsWith", "endsWith"] as const;
export type TStringOperator = (typeof STRING_OPERATORS)[number];
export const ZBaseOperator = z.enum(BASE_OPERATORS);
export type TBaseOperator = z.infer<typeof ZBaseOperator>;

// operators for date filters
export const DATE_OPERATORS = [
  "isOlderThan",
  "isNewerThan",
  "isBefore",
  "isAfter",
  "isBetween",
  "isSameDay",
  "isSet",
  "isNotSet",
] as const;

// time units for relative date operators
export const TIME_UNITS = ["days", "weeks", "months", "years"] as const;

// Operators for string type attributes only (text operations, no arithmetic)
export const STRING_TYPE_OPERATORS = [
  "equals",
  "notEquals",
  "isSet",
  "isNotSet",
  "contains",
  "doesNotContain",
  "startsWith",
  "endsWith",
] as const;

// Operators for number type attributes (arithmetic + basic)
export const NUMBER_TYPE_OPERATORS = [
  "equals",
  "notEquals",
  "lessThan",
  "lessEqual",
  "greaterThan",
  "greaterEqual",
  "isSet",
  "isNotSet",
] as const;

// Combined operators for backwards compatibility (used in validation)
export const STRING_ATTRIBUTE_OPERATORS = [
  ...BASE_OPERATORS,
  "isSet",
  "isNotSet",
  "contains",
  "doesNotContain",
  "startsWith",
  "endsWith",
] as const;

// An attribute filter can have these operators (including date operators)
export const ATTRIBUTE_OPERATORS = [...STRING_ATTRIBUTE_OPERATORS, ...DATE_OPERATORS] as const;

export const PERSON_OPERATORS = STRING_TYPE_OPERATORS;

// operators for segment filters
export const SEGMENT_OPERATORS = ["userIsIn", "userIsNotIn"] as const;

// operators for device filters
export const DEVICE_OPERATORS = ["equals", "notEquals"] as const;

// operators for survey interaction filters
export const SURVEY_INTERACTION_OPERATORS = [
  "haveCompleted",
  "haveNotCompleted",
  "haveSeen",
  "haveNotSeen",
  "haveStartedRespondingTo",
] as const;

export const ZSurveyInteractionOperator = z.enum(SURVEY_INTERACTION_OPERATORS);
export type TSurveyInteractionOperator = z.infer<typeof ZSurveyInteractionOperator>;

// time units allowed for the survey interaction window (subset of TIME_UNITS, no "years")
export const SURVEY_INTERACTION_TIME_UNITS = ["days", "weeks", "months"] as const;
export const ZSurveyInteractionTimeUnit = z.enum(SURVEY_INTERACTION_TIME_UNITS);
export type TSurveyInteractionTimeUnit = z.infer<typeof ZSurveyInteractionTimeUnit>;

// all operators
export const ALL_OPERATORS = [
  ...ATTRIBUTE_OPERATORS,
  ...SEGMENT_OPERATORS,
  ...SURVEY_INTERACTION_OPERATORS,
] as const;

export const ZAttributeOperator = z.enum(ATTRIBUTE_OPERATORS);
export type TAttributeOperator = z.infer<typeof ZAttributeOperator>;

export const ZPersonOperator = z.enum(PERSON_OPERATORS);
export type TPersonOperator = z.infer<typeof ZPersonOperator>;

export const ZSegmentOperator = z.enum(SEGMENT_OPERATORS);
export type TSegmentOperator = z.infer<typeof ZSegmentOperator>;

export const ZDeviceOperator = z.enum(DEVICE_OPERATORS);
export type TDeviceOperator = z.infer<typeof ZDeviceOperator>;

export const ZDateOperator = z.enum(DATE_OPERATORS);
export type TDateOperator = z.infer<typeof ZDateOperator>;

// Type guard to check if an operator is a date operator
export const isDateOperator = (operator: TAttributeOperator): operator is TDateOperator => {
  return (DATE_OPERATORS as readonly string[]).includes(operator);
};

export const ZTimeUnit = z.enum(TIME_UNITS);
export type TTimeUnit = z.infer<typeof ZTimeUnit>;

export type TAllOperators = (typeof ALL_OPERATORS)[number];

// Relative date value for operators like "isOlderThan" and "isNewerThan"
export const ZRelativeDateValue = z.object({
  amount: z.number(),
  unit: ZTimeUnit,
});
export type TRelativeDateValue = z.infer<typeof ZRelativeDateValue>;

// Structured value for survey interaction filters. Defined here (before ZSegmentFilterValue) so it
// can be part of the shared filter-value union that generic helpers like updateFilterValue operate on.
// The base object is kept separate from the refined schema so the exported TYPE is inferred from a
// plain ZodObject (spreadable in consumers); the refinement only adds runtime validation and does not
// change the output shape.
const ZSegmentSurveyInteractionFilterValueBase = z.object({
  surveyScope: z.enum(["any", "specific"]),
  surveyIds: z.array(z.string()),
  within: z.object({
    amount: z.number().int().min(1).max(999),
    unit: ZSurveyInteractionTimeUnit,
  }),
});
export const ZSegmentSurveyInteractionFilterValue = ZSegmentSurveyInteractionFilterValueBase.refine(
  (value) => value.surveyScope === "any" || value.surveyIds.length > 0,
  { error: "Select at least one survey" }
);
export type TSegmentSurveyInteractionFilterValue = z.infer<typeof ZSegmentSurveyInteractionFilterValueBase>;

export const ZSegmentFilterValue = z.union([
  z.string(),
  z.number(),
  ZRelativeDateValue,
  z.tuple([z.string(), z.string()]), // for "isBetween" operator
  ZSegmentSurveyInteractionFilterValue,
]);
export type TSegmentFilterValue = z.infer<typeof ZSegmentFilterValue>;

// Each filter has a qualifier, which usually contains the operator for evaluating the filter.
// Attribute filter -> root will always have type "attribute"
export const ZSegmentAttributeFilter = z.object({
  id: ZId,
  root: z.object({
    type: z.literal("attribute"),
    contactAttributeKey: z.string(),
  }),
  value: ZSegmentFilterValue,
  qualifier: z.object({
    operator: ZAttributeOperator,
  }),
});
export type TSegmentAttributeFilter = z.infer<typeof ZSegmentAttributeFilter>;

// Person filter -> root will always have type "person"
export const ZSegmentPersonFilter = z.object({
  id: ZId,
  root: z.object({
    type: z.literal("person"),
    personIdentifier: z.string(),
  }),
  value: ZSegmentFilterValue,
  qualifier: z.object({
    operator: ZPersonOperator,
  }),
});
export type TSegmentPersonFilter = z.infer<typeof ZSegmentPersonFilter>;

// Segment filter -> root will always have type "segment"
export const ZSegmentSegmentFilter = z.object({
  id: ZId,
  root: z.object({
    type: z.literal("segment"),
    segmentId: z.string(),
  }),
  value: ZSegmentFilterValue,
  qualifier: z.object({
    operator: ZSegmentOperator,
  }),
});
export type TSegmentSegmentFilter = z.infer<typeof ZSegmentSegmentFilter>;

// Device filter -> root will always have type "device"
export const ZSegmentDeviceFilter = z.object({
  id: ZId,
  root: z.object({
    type: z.literal("device"),
    deviceType: z.string(),
  }),
  value: ZSegmentFilterValue,
  qualifier: z.object({
    operator: ZDeviceOperator,
  }),
});

export type TSegmentDeviceFilter = z.infer<typeof ZSegmentDeviceFilter>;

// Survey interaction filter -> root will always have type "surveyInteraction".
// Behavioral targeting evaluated against the contact's Display/Response relations.
// The structured value (ZSegmentSurveyInteractionFilterValue) is defined above with the shared
// filter-value union.
export const ZSegmentSurveyInteractionFilter = z.object({
  id: ZId,
  root: z.object({
    type: z.literal("surveyInteraction"),
  }),
  value: ZSegmentSurveyInteractionFilterValue,
  qualifier: z.object({
    operator: ZSurveyInteractionOperator,
  }),
});
export type TSegmentSurveyInteractionFilter = z.infer<typeof ZSegmentSurveyInteractionFilter>;

// A segment filter is a union of all the different filter types
export const ZSegmentFilter = z
  .union([
    ZSegmentAttributeFilter,
    ZSegmentPersonFilter,
    ZSegmentSegmentFilter,
    ZSegmentDeviceFilter,
    ZSegmentSurveyInteractionFilter,
  ])
  // we need to refine the filter to make sure that the filter is valid
  .refine(
    (filter) => {
      // survey interaction filters carry a structured value validated by their own schema
      if (filter.root.type === "surveyInteraction") {
        return true;
      }

      // if the operator is an arithmentic operator, the value must be a number
      if (
        ARITHMETIC_OPERATORS.includes(filter.qualifier.operator as (typeof ARITHMETIC_OPERATORS)[number]) &&
        typeof filter.value !== "number"
      ) {
        return false;
      }

      // if the operator is a string operator, the value must be a string
      if (
        STRING_OPERATORS.includes(filter.qualifier.operator as (typeof STRING_OPERATORS)[number]) &&
        typeof filter.value !== "string"
      ) {
        return false;
      }

      // if the operator is a relative date operator (isOlderThan, isNewerThan), value must be an object with amount and unit
      if (
        (filter.qualifier.operator === "isOlderThan" || filter.qualifier.operator === "isNewerThan") &&
        (typeof filter.value !== "object" || !("amount" in filter.value) || !("unit" in filter.value))
      ) {
        return false;
      }

      // if the operator is an absolute date operator (isBefore, isAfter, isSameDay), value must be a string
      if (
        (filter.qualifier.operator === "isBefore" ||
          filter.qualifier.operator === "isAfter" ||
          filter.qualifier.operator === "isSameDay") &&
        typeof filter.value !== "string"
      ) {
        return false;
      }

      // if the operator is isBetween, value must be a tuple of two strings
      if (filter.qualifier.operator === "isBetween" && !Array.isArray(filter.value)) {
        return false;
      }

      return true;
    },
    {
      error:
        "Value must be a string for string operators, a number for arithmetic operators, and an object for relative date operators",
    }
  )
  .refine(
    (filter) => {
      const { value, qualifier } = filter;
      const { operator } = qualifier;

      // survey interaction filters carry a structured value validated by their own schema
      if (filter.root.type === "surveyInteraction") {
        return true;
      }

      // if the operator is "isSet" or "isNotSet", the value doesn't matter
      if (operator === "isSet" || operator === "isNotSet") {
        return true;
      }

      // for relative date operators, validate the object structure
      if (operator === "isOlderThan" || operator === "isNewerThan") {
        if (typeof value === "object" && "amount" in value && "unit" in value) {
          return value.amount > 0 && TIME_UNITS.includes(value.unit);
        }
        return false;
      }

      // for isBetween, validate we have a tuple with two non-empty strings
      if (operator === "isBetween") {
        if (!Array.isArray(value)) return false;
        return (
          typeof value[0] === "string" &&
          typeof value[1] === "string" &&
          value[0].length > 0 &&
          value[1].length > 0
        );
      }

      // for absolute date operators, validate we have a non-empty string
      if (operator === "isBefore" || operator === "isAfter" || operator === "isSameDay") {
        return typeof value === "string" && value.length > 0;
      }

      // for string values, check they're not empty
      if (typeof value === "string") {
        return value.length > 0;
      }

      return true;
    },
    {
      error: "Invalid value for filters: please check your filter values",
    }
  );

export type TSegmentFilter = z.infer<typeof ZSegmentFilter>;

export const ZSegmentConnector = z.enum(["and", "or"]).nullable();

export type TSegmentConnector = z.infer<typeof ZSegmentConnector>;

export interface TBaseFilter {
  id: string;
  connector: TSegmentConnector;
  resource: TSegmentFilter | TBaseFilters;
}

export type TBaseFilters = TBaseFilter[];

export const ZBaseFilter: z.ZodType<TBaseFilter> = z.lazy(() =>
  z.object({
    id: ZId,
    connector: ZSegmentConnector,
    resource: z.union([ZSegmentFilter, ZBaseFilters]),
  })
);

export const ZBaseFilters: z.ZodType<TBaseFilters> = z.lazy(() => z.array(ZBaseFilter));

// here again, we refine the filters to make sure that the filters are valid
const refineFilters = (filters: TBaseFilters): boolean => {
  let result = true;

  for (let i = 0; i < filters.length; i++) {
    const group = filters[i];

    if (Array.isArray(group.resource)) {
      result = refineFilters(group.resource);
    } else if (i === 0 && group.connector !== null) {
      // if the connector for a "first" group is not null, it's invalid
      result = false;
      break;
    }
  }

  return result;
};

// The filters can be nested, so we need to use z.lazy to define the type
// more on recusrsive types -> https://zod.dev/?id=recursive-types
export const ZSegmentFilters: z.ZodType<TBaseFilters> = z
  .array(
    z.object({
      id: ZId,
      connector: ZSegmentConnector,
      resource: z.union([ZSegmentFilter, z.lazy(() => ZSegmentFilters)]),
    })
  )
  .refine(refineFilters, {
    error: "Invalid filters applied",
  });

const ZRequiredSegmentFilters = ZSegmentFilters.refine((filters) => filters.length > 0, {
  error: "At least one filter is required",
});

export const ZSegment = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  isPrivate: z.boolean().prefault(true),
  filters: ZSegmentFilters,
  workspaceId: ZId,
  createdAt: z.date(),
  updatedAt: z.date(),
  surveys: z.array(z.string()),
});

// Minimal segment shape for the public client API — strips sensitive targeting logic
export const ZJsWorkspaceStateSegment = z.object({
  id: z.string(),
  hasFilters: z.boolean(),
});
export type TJsWorkspaceStateSegment = z.infer<typeof ZJsWorkspaceStateSegment>;

export const ZSegmentCreateInput = z.object({
  workspaceId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  isPrivate: z.boolean().prefault(true),
  filters: ZRequiredSegmentFilters,
  surveyId: z.string(),
});

export type TSegmentCreateInput = z.infer<typeof ZSegmentCreateInput>;

export type TSegment = z.infer<typeof ZSegment>;
export interface TSegmentSurveyReference {
  id: string;
  name: string;
}
export type TSegmentWithSurveyRefs = TSegment & {
  activeSurveys: TSegmentSurveyReference[];
  inactiveSurveys: TSegmentSurveyReference[];
};

export const ZSegmentUpdateInput = z
  .object({
    title: z.string(),
    description: z.string().nullable(),
    isPrivate: z.boolean().prefault(true),
    filters: ZRequiredSegmentFilters,
    surveys: z.array(z.string()),
  })
  .partial();

export type TSegmentUpdateInput = z.infer<typeof ZSegmentUpdateInput>;

// Record of the contact attribute key and the value
export type TEvaluateSegmentUserAttributeData = Record<string, string | number>;

export interface TEvaluateSegmentUserData {
  contactId: string;
  userId: string;
  attributes: TEvaluateSegmentUserAttributeData;
  deviceType: "phone" | "desktop";
}
