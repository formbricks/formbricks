import { z } from "zod";

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

// An attribute filter can have these operators
export const ATTRIBUTE_OPERATORS = [
  ...BASE_OPERATORS,
  "isSet",
  "isNotSet",
  "contains",
  "doesNotContain",
  "startsWith",
  "endsWith",
] as const;

// the person filter currently has the same operators as the attribute filter
// but we might want to add more operators in the future, so we keep it separated
export const PERSON_OPERATORS = ATTRIBUTE_OPERATORS;

// A metric is always only associated with an action filter
// Metrics are used to evaluate the value of an action filter, from the database
export const ACTION_METRICS = [
  "lastQuarterCount",
  "lastMonthCount",
  "lastWeekCount",
  "occuranceCount",
  "lastOccurranceDaysAgo",
  "firstOccurranceDaysAgo",
] as const;

// operators for segment filters
export const SEGMENT_OPERATORS = ["userIsIn", "userIsNotIn"] as const;

// operators for device filters
export const DEVICE_OPERATORS = ["equals", "notEquals"] as const;

// all operators
export const ALL_OPERATORS = [...ATTRIBUTE_OPERATORS, ...SEGMENT_OPERATORS] as const;

export const ZAttributeOperator = z.enum(ATTRIBUTE_OPERATORS);
export type TAttributeOperator = z.infer<typeof ZAttributeOperator>;

export const ZPersonOperator = z.enum(PERSON_OPERATORS);
export type TPersonOperator = z.infer<typeof ZPersonOperator>;

export const ZSegmentOperator = z.enum(SEGMENT_OPERATORS);
export type TSegmentOperator = z.infer<typeof ZSegmentOperator>;

export const ZDeviceOperator = z.enum(DEVICE_OPERATORS);
export type TDeviceOperator = z.infer<typeof ZDeviceOperator>;

export type TAllOperators = (typeof ALL_OPERATORS)[number];

export const ZActionMetric = z.enum(ACTION_METRICS);
export type TActionMetric = z.infer<typeof ZActionMetric>;

export const ZSegmentFilterValue = z.union([z.string(), z.number()]);
export type TSegmentFilterValue = z.infer<typeof ZSegmentFilterValue>;

// the type of the root of a filter
export const ZSegmentFilterRootType = z.enum(["attribute", "action", "segment", "device", "person"]);

// Root of the filter, this defines the type of the filter and the metadata associated with it
// For example, if the root is "attribute", the attributeClassName is required
// if the root is "action", the actionClassId is required.
export const ZSegmentFilterRoot = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(ZSegmentFilterRootType.Enum.attribute),
    attributeClassId: z.string(),
  }),
  z.object({
    type: z.literal(ZSegmentFilterRootType.Enum.person),
    userId: z.string(),
  }),
  z.object({
    type: z.literal(ZSegmentFilterRootType.Enum.action),
    actionClassId: z.string(),
  }),
  z.object({
    type: z.literal(ZSegmentFilterRootType.Enum.segment),
    segmentId: z.string(),
  }),
  z.object({
    type: z.literal(ZSegmentFilterRootType.Enum.device),
    deviceType: z.string(),
  }),
]);

// Each filter has a qualifier, which usually contains the operator for evaluating the filter.
// Only in the case of action filters, the metric is also included in the qualifier

// Attribute filter -> root will always have type "attribute"
export const ZSegmentAttributeFilter = z.object({
  id: z.string().cuid2(),
  root: z.object({
    type: z.literal("attribute"),
    attributeClassName: z.string(),
  }),
  value: ZSegmentFilterValue,
  qualifier: z.object({
    operator: ZAttributeOperator,
  }),
});
export type TSegmentAttributeFilter = z.infer<typeof ZSegmentAttributeFilter>;

// Person filter -> root will always have type "person"
export const ZSegmentPersonFilter = z.object({
  id: z.string().cuid2(),
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

// Action filter -> root will always have type "action"
// Action filters also have the metric along with the operator in the qualifier of the filter
export const ZSegmentActionFilter = z
  .object({
    id: z.string().cuid2(),
    root: z.object({
      type: z.literal("action"),
      actionClassId: z.string(),
    }),
    value: ZSegmentFilterValue,
    qualifier: z.object({
      metric: z.enum(ACTION_METRICS),
      operator: ZBaseOperator,
    }),
  })
  .refine(
    (actionFilter) => {
      const { value } = actionFilter;

      // if the value is not type of number, it's invalid

      const isValueNumber = typeof value === "number";

      if (!isValueNumber) {
        return false;
      }

      return true;
    },
    {
      message: "Value must be a number for action filters",
    }
  );
export type TSegmentActionFilter = z.infer<typeof ZSegmentActionFilter>;

// Segment filter -> root will always have type "segment"
export const ZSegmentSegmentFilter = z.object({
  id: z.string().cuid2(),
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
  id: z.string().cuid2(),
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

// A segment filter is a union of all the different filter types
export const ZSegmentFilter = z
  .union([
    ZSegmentActionFilter,
    ZSegmentAttributeFilter,
    ZSegmentPersonFilter,
    ZSegmentSegmentFilter,
    ZSegmentDeviceFilter,
  ])
  // we need to refine the filter to make sure that the filter is valid
  .refine(
    (filter) => {
      if (filter.root.type === "action") {
        if (!("metric" in filter.qualifier)) {
          return false;
        }
      }

      return true;
    },
    {
      message: "Metric operator must be specified for action filters",
    }
  )
  .refine(
    (filter) => {
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

      return true;
    },
    {
      message: "Value must be a string for string operators and a number for arithmetic operators",
    }
  )
  .refine(
    (filter) => {
      const { value, qualifier } = filter;
      const { operator } = qualifier;

      // if the operator is "isSet" or "isNotSet", the value doesn't matter
      if (operator === "isSet" || operator === "isNotSet") {
        return true;
      }

      if (typeof value === "string") {
        return value.length > 0;
      }

      return true;
    },
    {
      message: "Invalid value for filters: please check your filter values",
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
    id: z.string().cuid2(),
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

// TODO: Figure out why this is not working, and then remove the ts-ignore
export const ZSegmentFilters: z.ZodType<TBaseFilters> = z
  .array(
    z.object({
      id: z.string().cuid2(),
      connector: ZSegmentConnector,
      resource: z.union([ZSegmentFilter, z.lazy(() => ZSegmentFilters)]),
    })
  )
  .refine(refineFilters, {
    message: "Invalid filters applied",
  });

export const ZSegment = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  isPrivate: z.boolean().default(true),
  filters: ZSegmentFilters,
  environmentId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  surveys: z.array(z.string()),
});

export const ZSegmentCreateInput = z.object({
  environmentId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  isPrivate: z.boolean().default(true),
  filters: ZSegmentFilters,
  surveyId: z.string(),
});

export type TSegmentCreateInput = z.infer<typeof ZSegmentCreateInput>;

export type TSegment = z.infer<typeof ZSegment>;
export type TSegmentWithSurveyNames = TSegment & {
  activeSurveys: string[];
  inactiveSurveys: string[];
};

export const ZSegmentUpdateInput = z
  .object({
    title: z.string(),
    description: z.string().nullable(),
    isPrivate: z.boolean().default(true),
    filters: ZSegmentFilters,
    surveys: z.array(z.string()),
  })
  .partial();

export type TSegmentUpdateInput = z.infer<typeof ZSegmentUpdateInput>;

export type TEvaluateSegmentUserAttributeData = Record<string, string | number>;

export interface TEvaluateSegmentUserData {
  personId: string;
  userId: string;
  environmentId: string;
  attributes: TEvaluateSegmentUserAttributeData;
  actionIds: string[];
  deviceType: "phone" | "desktop";
}
