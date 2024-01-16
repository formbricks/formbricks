import { z } from "zod";

// import { ZId } from "./environment";

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

export const ATTRIBUTE_OPERATORS = [
  ...BASE_OPERATORS,
  "isSet",
  "contains",
  "doesNotContain",
  "startsWith",
  "endsWith",
] as const;
export const ZAttributeOperator = z.enum(ATTRIBUTE_OPERATORS);
export type TAttributeOperator = z.infer<typeof ZAttributeOperator>;

export const SEGMENT_OPERATORS = ["userIsIn", "userIsNotIn"] as const;
export const ZSegmentOperator = z.enum(SEGMENT_OPERATORS);
export type TSegmentOperator = z.infer<typeof ZSegmentOperator>;

export const DEVICE_OPERATORS = ["equals", "notEquals"] as const;
export const ZDeviceOperator = z.enum(DEVICE_OPERATORS);
export type TDeviceOperator = z.infer<typeof ZDeviceOperator>;

const ALL_OPERATORS = [...ATTRIBUTE_OPERATORS, ...SEGMENT_OPERATORS, ...DEVICE_OPERATORS] as const;
export type TAllOperators = (typeof ALL_OPERATORS)[number];

export const ACTION_METRICS = [
  "lastQuarterCount",
  "lastMonthCount",
  "lastWeekCount",
  "occuranceCount",
  "lastOccurranceDaysAgo",
  "firstOccurranceDaysAgo",
] as const;
export const ZActionMetric = z.enum(ACTION_METRICS);
export type TActionMetric = z.infer<typeof ZActionMetric>;

export const ZUserSegmentFilterValue = z.union([z.string(), z.number()]);
export type TUserSegmentFilterValue = z.infer<typeof ZUserSegmentFilterValue>;

// Root of the filter
export const ZUserSegmentFilterRootType = z.enum(["attribute", "action", "segment", "device"]);

export const ZUserSegmentFilterRoot = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(ZUserSegmentFilterRootType.Enum.attribute),
    attributeClassId: z.string(),
  }),
  z.object({
    type: z.literal(ZUserSegmentFilterRootType.Enum.action),
    actionClassId: z.string(),
  }),
  z.object({
    type: z.literal(ZUserSegmentFilterRootType.Enum.segment),
    userSegmentId: z.string(),
  }),
  z.object({
    type: z.literal(ZUserSegmentFilterRootType.Enum.device),
    deviceType: z.string(),
  }),
]);

export const ZUserSegmentAttributeFilter = z.object({
  id: z.string().cuid2(),
  root: z.object({
    type: z.literal("attribute"),
    attributeClassId: z.string(),
  }),
  value: ZUserSegmentFilterValue,
  qualifier: z.object({
    operator: ZAttributeOperator,
  }),
});
export type TUserSegmentAttributeFilter = z.infer<typeof ZUserSegmentAttributeFilter>;

export const ZUserSegmentActionFilter = z
  .object({
    id: z.string().cuid2(),
    root: z.object({
      type: z.literal("action"),
      actionClassId: z.string(),
    }),
    value: ZUserSegmentFilterValue,
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
export type TUserSegmentActionFilter = z.infer<typeof ZUserSegmentActionFilter>;

export const ZUserSegmentSegmentFilter = z.object({
  id: z.string().cuid2(),
  root: z.object({
    type: z.literal("segment"),
    userSegmentId: z.string(),
  }),
  value: ZUserSegmentFilterValue,
  qualifier: z.object({
    operator: ZSegmentOperator,
  }),
});
export type TUserSegmentSegmentFilter = z.infer<typeof ZUserSegmentSegmentFilter>;

export const ZUserSegmentDeviceFilter = z.object({
  id: z.string().cuid2(),
  root: z.object({
    type: z.literal("device"),
    deviceType: z.string(),
  }),
  value: ZUserSegmentFilterValue,
  qualifier: z.object({
    operator: ZDeviceOperator,
  }),
});

export type TUserSegmentDeviceFilter = z.infer<typeof ZUserSegmentDeviceFilter>;

export const ZUserSegmentFilter = z
  .union([
    ZUserSegmentActionFilter,
    ZUserSegmentAttributeFilter,
    ZUserSegmentSegmentFilter,
    ZUserSegmentDeviceFilter,
  ])
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
  .refine((filter) => {
    const { value, qualifier } = filter;
    const { operator } = qualifier;

    // if the operator is "isSet", the value doesn't matter
    if (operator === "isSet") {
      return true;
    }

    if (typeof value === "string") {
      return value.length > 0;
    }

    return true;
  });

export type TUserSegmentFilter = z.infer<typeof ZUserSegmentFilter>;

export const ZUserSegmentConnector = z.enum(["and", "or"]).nullable();

export type TUserSegmentConnector = z.infer<typeof ZUserSegmentConnector>;

export type TBaseFilterGroupItem = {
  id: string;
  connector: TUserSegmentConnector;
  resource: TUserSegmentFilter | TBaseFilterGroup;
};
export type TBaseFilterGroup = TBaseFilterGroupItem[];

const refineFilterGroup = (filterGroup: TBaseFilterGroup): boolean => {
  let result = true;

  for (let i = 0; i < filterGroup.length; i++) {
    const group = filterGroup[i];

    if (Array.isArray(group.resource)) {
      result = refineFilterGroup(group.resource);
    } else {
      // if the connector for a "first" group is not null, it's invalid
      if (i === 0 && group.connector !== null) {
        result = false;
        break;
      }
    }
  }

  return result;
};

export const ZUserSegmentFilterGroup: z.ZodType<TBaseFilterGroup> = z
  .lazy(() =>
    z.array(
      z.object({
        id: z.string().cuid2(),
        connector: ZUserSegmentConnector,
        resource: z.union([ZUserSegmentFilter, ZUserSegmentFilterGroup]),
      })
    )
  )
  .refine(refineFilterGroup, {
    message: "Invalid filters applied",
  });

export const ZUserSegment = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  isPrivate: z.boolean().default(true),
  filters: ZUserSegmentFilterGroup,
  environmentId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),

  // describes which surveys is this segment applicable to
  surveys: z.array(z.string()),
  // surveys: z.array(z.object({ id: ZId })),
});

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

export type TUserSegment = z.infer<typeof ZUserSegment>;

export const ZUserSegmentUpdateInput = z
  .object({
    title: z.string(),
    description: z.string().nullable(),
    isPrivate: z.boolean().default(true),
    filters: ZUserSegmentFilterGroup,
    surveys: z.array(z.string()),
  })
  .partial();

export type TUserSegmentUpdateInput = z.infer<typeof ZUserSegmentUpdateInput>;

// type guard to check if a resource is a filter
export const isResourceFilter = (
  resource: TUserSegmentFilter | TBaseFilterGroup
): resource is TUserSegmentFilter => {
  return (resource as TUserSegmentFilter).root !== undefined;
};
