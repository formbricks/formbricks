import { Prisma } from "@prisma/client";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";

export const BASE_OPERATORS = [
  "equals",
  "notEquals",
  "lessThan",
  "lessEqual",
  "greaterThan",
  "greaterEqual",
] as const;

export const ATTRIBUTE_OPERATORS = [
  ...BASE_OPERATORS,
  "contains",
  "doesNotContain",
  "startsWith",
  "endsWith",
] as const;

const SEGMENT_OPERATORS = ["userIsIn", "userIsNotIn"] as const;

const DEVICE_OPERATORS = ["equals", "notEquals"] as const;

const ALL_OPERATORS = [...ATTRIBUTE_OPERATORS, ...SEGMENT_OPERATORS, ...DEVICE_OPERATORS] as const;
export type TAllOperators = (typeof ALL_OPERATORS)[number];

const ACTION_METRICS = [
  "lastQuarterCount",
  "lastMonthCount",
  "lastWeekCount",
  "occuranceCount",
  "lastOccurranceDaysAgo",
  "firstOccurranceDaysAgo",
] as const;

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
  root: ZUserSegmentFilterRoot,
  value: ZUserSegmentFilterValue,
  qualifier: z.object({
    operator: z.enum(ATTRIBUTE_OPERATORS),
  }),
});

export const ZUserSegmentActionFilter = z.object({
  id: z.string().cuid2(),
  root: ZUserSegmentFilterRoot,
  value: ZUserSegmentFilterValue,
  qualifier: z.object({
    metric: z.enum(ACTION_METRICS),
    operator: z.enum(BASE_OPERATORS),
  }),
});

export const ZUserSegmentSegmentFilter = z.object({
  id: z.string().cuid2(),
  root: ZUserSegmentFilterRoot,
  value: ZUserSegmentFilterValue,
  qualifier: z.object({
    operator: z.enum(SEGMENT_OPERATORS),
  }),
});

export const ZUserSegmentDeviceFilter = z.object({
  id: z.string().cuid2(),
  root: ZUserSegmentFilterRoot,
  value: ZUserSegmentFilterValue,
  qualifier: z.object({
    operator: z.enum(DEVICE_OPERATORS),
  }),
});

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
      message: "Metric is required for action filter",
    }
  );

export type TUserSegmentFilter = z.infer<typeof ZUserSegmentFilter>;

export type TBaseFilterGroupItem = {
  id: string;
  connector: "and" | "or" | null;
  resource: TUserSegmentFilter | TBaseFilterGroup;
};

export type TBaseFilterGroup = TBaseFilterGroupItem[];

const refineFilterGroup = (filterGroup: TBaseFilterGroup): boolean => {
  let isValid = true;

  for (let i = 0; i < filterGroup.length; i++) {
    const group = filterGroup[i];

    if (Array.isArray(group.resource)) {
      isValid = refineFilterGroup(group.resource);
    }

    if (i === 0 && group.connector !== null) {
      isValid = false;
      break;
    }
  }

  return isValid;
};

export const ZUserSegmentFilterGroup: z.ZodType<TBaseFilterGroup> = z
  .lazy(() =>
    z.array(
      z.object({
        id: z.string().cuid2(),
        connector: z.enum(["and", "or"]).nullable(),
        resource: z.union([ZUserSegmentFilter, ZUserSegmentFilterGroup]),
      })
    )
  )
  .refine(refineFilterGroup, { message: "First filter group must not have connector" });

export const ZUserSegment = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  private: z.boolean().default(true),
  filters: ZUserSegmentFilterGroup,
  environmentId: z.string(),

  // describes which surveys is this segment applicable to
  surveys: z.array(z.string()),
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
    case "contains":
      return "contains";
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

export const convertMetricToText = (metric: (typeof ACTION_METRICS)[number]) => {
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

export type TUserSegmentUpdateInput = Omit<
  Prisma.UserSegmentUpdateInput,
  "id" | "createdAt" | "updatedAt" | "environmentId"
>;

export const sampleUserSegment: TUserSegment = {
  id: "segment123",
  name: "Sample User Segment",
  description: "A sample user segment description",
  private: false,
  filters: [
    {
      id: createId(),
      connector: null,
      resource: {
        id: createId(),
        root: {
          type: "attribute",
          attributeClassId: "cllkgdvdn000k195wxygd0ua6",
        },
        value: "free",
        qualifier: {
          operator: "equals",
        },
      },
    },
    {
      id: createId(),
      connector: "and",
      resource: {
        id: createId(),
        root: { type: "attribute", attributeClassId: "cllkgdvdn000l195w5olqltq7" },
        qualifier: { operator: "equals" },
        value: 3,
      },
    },
    {
      id: createId(),
      connector: "or",
      resource: [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(),
            root: { type: "attribute", attributeClassId: "cllkgdvdn000l195w5olqltq7" },
            qualifier: { operator: "equals" },
            value: 3,
          },
        },
        {
          id: createId(),
          connector: "and",
          resource: [
            {
              id: createId(),
              connector: null,
              resource: {
                id: createId(),
                root: {
                  type: "action",
                  actionClassId: "cllkgdvdn000i195wkdnvccun",
                },
                qualifier: {
                  metric: "occuranceCount",
                  operator: "greaterThan",
                },
                value: 3,
              },
            },
            {
              id: createId(),
              connector: "or",
              resource: {
                id: createId(),
                root: {
                  type: "attribute",
                  attributeClassId: "cllkgdveb000y195w8roob8xp",
                },
                qualifier: {
                  operator: "equals",
                },
                value: "free",
              },
            },
          ],
        },
        {
          id: createId(),
          connector: "and",
          resource: {
            id: createId(),
            root: {
              type: "attribute",
              attributeClassId: "cllkgdveb000y195w8roob8xp",
            },
            qualifier: {
              operator: "equals",
            },
            value: "free",
          },
        },
      ],
    },
  ],
  surveys: ["survey123", "survey456"],
  environmentId: "env123",
};
