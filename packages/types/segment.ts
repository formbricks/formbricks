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

export const ZSegmentFilterValue = z.union([z.string(), z.number()]);
export type TSegmentFilterValue = z.infer<typeof ZSegmentFilterValue>;

// Each filter has a qualifier, which usually contains the operator for evaluating the filter.
// Attribute filter -> root will always have type "attribute"
export const ZSegmentAttributeFilter = z.object({
  id: z.string().cuid2(),
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
  .union([ZSegmentAttributeFilter, ZSegmentPersonFilter, ZSegmentSegmentFilter, ZSegmentDeviceFilter])
  // we need to refine the filter to make sure that the filter is valid
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

// Record of the contact attribute key and the value
export type TEvaluateSegmentUserAttributeData = Record<string, string | number>;

export interface TEvaluateSegmentUserData {
  contactId: string;
  userId: string;
  environmentId: string;
  attributes: TEvaluateSegmentUserAttributeData;
  deviceType: "phone" | "desktop";
}
