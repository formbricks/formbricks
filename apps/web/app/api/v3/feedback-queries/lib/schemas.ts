import { z } from "zod";
import { DATE_RANGE_PRESETS } from "@/lib/date-ranges";
import {
  FEEDBACK_FIELDS,
  FILTER_OPERATORS,
  type FilterOperator,
  TIME_GRANULARITIES,
} from "@/modules/ee/analysis/lib/schema-definition";

/**
 * The public Feedback query (ADR 0001, ADR 0016): a Cube.js query over the `FeedbackRecords` model,
 * tightened for callers we do not control. Members come from the field catalog and nowhere else, the Cube
 * options the product never uses are not part of the shape, and every collection is bounded.
 *
 * The schema is strict by construction rather than by a separate "reject unknown options" pass, so a
 * misspelled or unsupported key is a 400 that names it. The tenant is deliberately not a member of the
 * shape: the Feedback Dataset is resolved from the workspace on the server and Cube's `queryRewrite`
 * appends the tenant filter, so no input can name or widen it.
 */

export const V3_FEEDBACK_QUERY_MAX_MEASURES = 10;
export const V3_FEEDBACK_QUERY_MAX_DIMENSIONS = 5;
export const V3_FEEDBACK_QUERY_MAX_ORDER = 5;
/** Member filters plus and/or groups, counted over the whole tree. */
export const V3_FEEDBACK_QUERY_MAX_FILTER_NODES = 20;
/** Nesting of and/or groups: the top-level array is depth 0, so `[{ or: [{ and: [...] }] }]` is depth 2. */
export const V3_FEEDBACK_QUERY_MAX_FILTER_DEPTH = 3;
export const V3_FEEDBACK_QUERY_MAX_FILTER_VALUES = 50;
export const V3_FEEDBACK_QUERY_MAX_FILTER_VALUE_LENGTH = 256;
export const V3_FEEDBACK_QUERY_DEFAULT_LIMIT = 100;
export const V3_FEEDBACK_QUERY_MAX_LIMIT = 1000;

const measureIds = FEEDBACK_FIELDS.measures.map((measure) => measure.id);
const dimensionIds = FEEDBACK_FIELDS.dimensions.map((dimension) => dimension.id);
const timeDimensionIds = FEEDBACK_FIELDS.dimensions
  .filter((dimension) => dimension.type === "time")
  .map((dimension) => dimension.id);

const CATALOG_HINT = "Use get_feedback_field_catalog to list the available fields.";

const catalogEnum = (kind: string, ids: readonly string[]) =>
  z.enum(ids, {
    error: (issue) =>
      `Unknown ${kind} '${String(issue.input).slice(0, 80)}'. Use one of the ${kind}s in the field catalog. ${CATALOG_HINT}`,
  });

const ZMeasureId = catalogEnum("measure", measureIds);
const ZDimensionId = catalogEnum("dimension", dimensionIds);
const ZTimeDimensionId = catalogEnum("time dimension", timeDimensionIds);

const FILTER_OPERATOR_IDS = [
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "set",
  "notSet",
  "gt",
  "gte",
  "lt",
  "lte",
] as const satisfies readonly FilterOperator[];

const DATE_LITERAL = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z?)?$/;
const ZDateLiteral = z
  .string()
  .regex(DATE_LITERAL, "Use YYYY-MM-DD, or an ISO 8601 UTC timestamp such as 2026-01-31T23:59:59Z.")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Not a valid date.");

const ZTimeDimension = z
  .object({
    dimension: ZTimeDimensionId,
    granularity: z.enum(TIME_GRANULARITIES).optional(),
    dateRange: z.union([z.enum(DATE_RANGE_PRESETS), z.tuple([ZDateLiteral, ZDateLiteral])]).optional(),
  })
  .strict()
  .refine(
    ({ dateRange }) => !Array.isArray(dateRange) || Date.parse(dateRange[0]) <= Date.parse(dateRange[1]),
    { message: "dateRange must start on or before the day it ends.", path: ["dateRange"] }
  );

export type TV3FeedbackQueryFilter =
  | { member: string; operator: FilterOperator; values?: string[] }
  | { and: TV3FeedbackQueryFilter[] }
  | { or: TV3FeedbackQueryFilter[] };

const ZMemberFilter = z
  .object({
    member: ZDimensionId,
    operator: z.enum(FILTER_OPERATOR_IDS),
    values: z
      .array(z.string().max(V3_FEEDBACK_QUERY_MAX_FILTER_VALUE_LENGTH))
      .max(V3_FEEDBACK_QUERY_MAX_FILTER_VALUES)
      .optional(),
  })
  .strict();

/**
 * Recursive on the wire, bounded in the refinement below. The arrays are capped here so a single group
 * cannot be wide, and the whole tree's depth and size are checked once the shape has parsed.
 */
const ZFeedbackQueryFilter: z.ZodType<TV3FeedbackQueryFilter> = z.lazy(() =>
  z.union([
    ZMemberFilter,
    z.object({ and: z.array(ZFeedbackQueryFilter).max(V3_FEEDBACK_QUERY_MAX_FILTER_NODES) }).strict(),
    z.object({ or: z.array(ZFeedbackQueryFilter).max(V3_FEEDBACK_QUERY_MAX_FILTER_NODES) }).strict(),
  ])
);

const ZOrderEntry = z.tuple([
  z.enum([...measureIds, ...dimensionIds], {
    error: (issue) =>
      `Unknown order member '${String(issue.input).slice(0, 80)}'. Order by a selected measure or dimension.`,
  }),
  z.enum(["asc", "desc"]),
]);

/** The plain field object, kept apart from the refined query so the MCP input schema can reuse its shape. */
export const ZV3FeedbackQueryFields = z
  .object({
    measures: z
      .array(ZMeasureId)
      .max(V3_FEEDBACK_QUERY_MAX_MEASURES)
      .optional()
      .describe(
        `What to compute per group, for example FeedbackRecords.npsScore or FeedbackRecords.count. At most ${V3_FEEDBACK_QUERY_MAX_MEASURES}. ${CATALOG_HINT}`
      ),
    dimensions: z
      .array(ZDimensionId)
      .max(V3_FEEDBACK_QUERY_MAX_DIMENSIONS)
      .optional()
      .describe(
        `What to group by, for example FeedbackRecords.fieldLabel or FeedbackRecords.sentiment. At most ${V3_FEEDBACK_QUERY_MAX_DIMENSIONS}. Query a dimension with FeedbackRecords.count to see the values it holds.`
      ),
    timeDimensions: z
      .array(ZTimeDimension)
      .max(1)
      .optional()
      .describe(
        "One time axis: a time dimension such as FeedbackRecords.collectedAt, an optional granularity to bucket by, and an optional dateRange (a preset name or a [start, end] pair of dates). Dates are read in the organization's reporting time zone."
      ),
    filters: z
      .array(ZFeedbackQueryFilter)
      .max(V3_FEEDBACK_QUERY_MAX_FILTER_NODES)
      .optional()
      .describe(
        `Conditions on dimensions, all of which must hold. Each is { member, operator, values } or a group { and: [...] } / { or: [...] }. At most ${V3_FEEDBACK_QUERY_MAX_FILTER_NODES} conditions and groups in total, nested at most ${V3_FEEDBACK_QUERY_MAX_FILTER_DEPTH} deep. Operators depend on the field type; set and notSet take no values; every value is a string.`
      ),
    order: z
      .array(ZOrderEntry)
      .max(V3_FEEDBACK_QUERY_MAX_ORDER)
      .optional()
      .describe(
        "Sort as [member, 'asc' | 'desc'] pairs, in priority order. Each member must be one of the query's measures, dimensions or time dimensions."
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(V3_FEEDBACK_QUERY_MAX_LIMIT)
      .optional()
      .describe(
        `Maximum rows to return, ${V3_FEEDBACK_QUERY_DEFAULT_LIMIT} when omitted and at most ${V3_FEEDBACK_QUERY_MAX_LIMIT}. There is no paging; narrow the query instead.`
      ),
  })
  .strict();

type TFilterIssue = { path: (string | number)[]; message: string };

const isMemberFilter = (
  filter: TV3FeedbackQueryFilter
): filter is Extract<TV3FeedbackQueryFilter, { member: string }> => "member" in filter;

/** Whether `value` reads as the type of the field it is compared with, so Cube is never handed a type error. */
const valueMatchesFieldType = (type: "string" | "number" | "time" | "boolean", value: string): boolean => {
  if (type === "number") return value.trim() !== "" && Number.isFinite(Number(value));
  if (type === "boolean") return value === "true" || value === "false";
  if (type === "time") return !Number.isNaN(Date.parse(value));
  return true;
};

const checkMemberFilter = (
  filter: Extract<TV3FeedbackQueryFilter, { member: string }>,
  path: (string | number)[]
): TFilterIssue[] => {
  // A member filter names a dimension; the enum guarantees it is in the catalog, so a miss here would
  // mean the catalog and the enum disagree.
  const fieldType = FEEDBACK_FIELDS.dimensions.find((dimension) => dimension.id === filter.member)?.type;
  if (!fieldType) {
    return [{ path: [...path, "member"], message: `'${filter.member}' cannot be filtered. ${CATALOG_HINT}` }];
  }

  const issues: TFilterIssue[] = [];
  const allowed = FILTER_OPERATORS[fieldType] ?? [];
  if (!allowed.includes(filter.operator)) {
    issues.push({
      path: [...path, "operator"],
      message: `Operator '${filter.operator}' is not valid for the ${fieldType} field '${filter.member}'. Use one of: ${allowed.join(", ")}.`,
    });
  }

  const values = filter.values ?? [];
  if (filter.operator === "set" || filter.operator === "notSet") {
    if (values.length > 0) {
      issues.push({ path: [...path, "values"], message: `Operator '${filter.operator}' takes no values.` });
    }
  } else if (values.length === 0) {
    issues.push({
      path: [...path, "values"],
      message: `Operator '${filter.operator}' needs at least one value.`,
    });
  } else {
    values.forEach((value, index) => {
      if (!valueMatchesFieldType(fieldType, value)) {
        issues.push({
          path: [...path, "values", index],
          message: `'${value.slice(0, 40)}' is not a valid ${fieldType} value for '${filter.member}'.`,
        });
      }
    });
  }

  return issues;
};

/**
 * Depth, size, operator and value checks over the whole filter tree. Walks at most the node budget, so a
 * hostile tree costs a bounded amount of work however it is nested. Stops descending at the depth cap
 * rather than recursing into a tree that has already failed.
 */
const checkFilterTree = (filters: TV3FeedbackQueryFilter[] | undefined): TFilterIssue[] => {
  const issues: TFilterIssue[] = [];
  let nodes = 0;

  const visit = (list: TV3FeedbackQueryFilter[], path: (string | number)[], depth: number): void => {
    list.forEach((filter, index) => {
      if (nodes > V3_FEEDBACK_QUERY_MAX_FILTER_NODES) return;
      nodes += 1;
      const here = [...path, index];

      if (isMemberFilter(filter)) {
        issues.push(...checkMemberFilter(filter, here));
        return;
      }

      const key = "and" in filter ? "and" : "or";
      const children = "and" in filter ? filter.and : filter.or;
      if (children.length === 0) {
        issues.push({ path: [...here, key], message: `An empty '${key}' group filters nothing; remove it.` });
        return;
      }
      if (depth + 1 > V3_FEEDBACK_QUERY_MAX_FILTER_DEPTH) {
        issues.push({
          path: here,
          message: `Filter groups nest at most ${V3_FEEDBACK_QUERY_MAX_FILTER_DEPTH} levels deep.`,
        });
        return;
      }
      visit(children, [...here, key], depth + 1);
    });
  };

  visit(filters ?? [], ["filters"], 0);
  if (nodes > V3_FEEDBACK_QUERY_MAX_FILTER_NODES) {
    issues.push({
      path: ["filters"],
      message: `A query carries at most ${V3_FEEDBACK_QUERY_MAX_FILTER_NODES} filter conditions and groups in total.`,
    });
  }
  return issues;
};

/** The query as a caller may send it. */
export const ZV3FeedbackQuery = ZV3FeedbackQueryFields.superRefine((query, ctx) => {
  if ((query.measures?.length ?? 0) === 0 && (query.dimensions?.length ?? 0) === 0) {
    ctx.addIssue({
      code: "custom",
      message: "Select at least one measure or dimension.",
      path: ["measures"],
    });
  }

  const selected = new Set<string>([
    ...(query.measures ?? []),
    ...(query.dimensions ?? []),
    ...(query.timeDimensions ?? []).map((timeDimension) => timeDimension.dimension),
  ]);
  (query.order ?? []).forEach(([member], index) => {
    if (!selected.has(member)) {
      ctx.addIssue({
        code: "custom",
        message: `Cannot order by '${member}': it is not one of the query's measures, dimensions or time dimensions.`,
        path: ["order", index, 0],
      });
    }
  });

  for (const issue of checkFilterTree(query.filters)) {
    ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
  }
});

export type TV3FeedbackQuery = z.infer<typeof ZV3FeedbackQuery>;

export const ZV3FeedbackQueryBody = z
  .object({
    workspaceId: z.cuid2(),
    datasetId: z.cuid2().optional(),
    query: ZV3FeedbackQuery,
  })
  .strict();

export type TV3FeedbackQueryBody = z.infer<typeof ZV3FeedbackQueryBody>;

export const ZV3FeedbackFieldCatalogQuery = z.object({ workspaceId: z.cuid2() }).strict();

export type TV3FeedbackFieldCatalogQuery = z.infer<typeof ZV3FeedbackFieldCatalogQuery>;
