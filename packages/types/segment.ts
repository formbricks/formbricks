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
  // Bounded to cap the payload from an untrusted client (no unbounded array). 100 surveys is far
  // beyond any realistic single-filter selection. Ownership is still enforced at write time by
  // assertSurveyInteractionSurveyIds (checks the ids exist in the workspace).
  surveyIds: z.array(ZId).max(100),
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

/**
 * Maximum number of filter nodes — leaf filters plus nested groups — across the WHOLE recursive
 * filter tree. The tree schema has no per-level length cap, so a per-level `.max()` alone would be
 * bypassable by nesting; only a total bound keeps the tree size itself from being an unbounded
 * payload (ENG-2305, sibling of ENG-2004). The same schema also parses trees read back from the
 * database (clone, publish validation, segment editor), so the cap is deliberately generous —
 * orders of magnitude above anything the segment editor produces — to never brick a pre-existing
 * segment on read.
 */
export const MAX_SEGMENT_FILTERS_PER_TREE = 1000;

/**
 * Maximum nesting depth of the filter tree. The recursive Zod parse (and every recursive consumer
 * of a parsed tree) grows the JS call stack with nesting depth and overflows around depth ~1000 in
 * practice — a RangeError that `safeParse` does NOT catch, so no post-parse `.refine` can guard
 * against it; only a pre-parse check can (see ZSegmentFilters). The editor produces single-digit
 * depth; 50 leaves ~20x headroom below the measured stack limit.
 */
export const MAX_SEGMENT_FILTER_DEPTH = 50;

/**
 * Maximum total surveyIds across every survey-interaction filter in the tree. The per-filter cap
 * (100) times the node cap would still admit 100k ids in one request — hundreds of sequential
 * batched lookups, each holding a pooled DB connection. 1000 total ids means at most a handful of
 * batches at write time, and is far beyond any tree the editor produces.
 */
export const MAX_SEGMENT_SURVEY_INTERACTION_IDS_PER_TREE = 1000;

const countLeafSurveyInteractionIds = (resource: unknown): number => {
  if (typeof resource !== "object" || resource === null) return 0;
  const { root, value } = resource as { root?: unknown; value?: unknown };
  if (typeof root !== "object" || root === null) return 0;
  if ((root as { type?: unknown }).type !== "surveyInteraction") return 0;
  if (typeof value !== "object" || value === null) return 0;
  const surveyIds = (value as { surveyIds?: unknown }).surveyIds;
  return Array.isArray(surveyIds) ? surveyIds.length : 0;
};

/**
 * Measures the raw (untrusted, unparsed) filter tree in one linear pass: total nodes, max nesting
 * depth, and total survey-interaction surveyIds. Iterative (explicit stack) on purpose — this walk
 * is what protects the recursive parse from stack overflow, so it must not recurse itself. Junk
 * shapes are simply not counted; shape errors are the schema's job.
 */
const measureSegmentFilterTree = (
  raw: unknown
): { nodes: number; depth: number; surveyInteractionIds: number } => {
  let nodes = 0;
  let depth = 0;
  let surveyInteractionIds = 0;

  const pending: { group: unknown[]; level: number }[] = [];
  if (Array.isArray(raw)) {
    pending.push({ group: raw, level: 1 });
  }

  let entry = pending.pop();
  while (entry) {
    const { group, level } = entry;
    depth = Math.max(depth, level);
    for (const node of group) {
      nodes += 1;
      const resource =
        typeof node === "object" && node !== null ? (node as { resource?: unknown }).resource : undefined;
      if (Array.isArray(resource)) {
        pending.push({ group: resource, level: level + 1 });
      } else {
        surveyInteractionIds += countLeafSurveyInteractionIds(resource);
      }
    }
    entry = pending.pop();
  }

  return { nodes, depth, surveyInteractionIds };
};

/**
 * Returns a human-readable message when the raw tree exceeds any bound, or null when it is within
 * all of them. Shared by ZSegmentFilters (rejects at the schema boundary, before the recursive
 * parse) and the survey draft-save path, which skips full semantic validation but must never
 * persist an over-bounds tree.
 */
export const getSegmentFilterTreeBoundsViolation = (raw: unknown): string | null => {
  const { nodes, depth, surveyInteractionIds } = measureSegmentFilterTree(raw);

  if (depth > MAX_SEGMENT_FILTER_DEPTH) {
    return `Segment filters are nested too deeply: at most ${MAX_SEGMENT_FILTER_DEPTH} levels are supported`;
  }
  if (nodes > MAX_SEGMENT_FILTERS_PER_TREE) {
    return `Too many filters: a segment supports at most ${MAX_SEGMENT_FILTERS_PER_TREE} filters in total`;
  }
  if (surveyInteractionIds > MAX_SEGMENT_SURVEY_INTERACTION_IDS_PER_TREE) {
    return `Too many surveys referenced: survey-interaction filters may reference at most ${MAX_SEGMENT_SURVEY_INTERACTION_IDS_PER_TREE} surveys in total`;
  }
  return null;
};

// The filters can be nested, so we need to use z.lazy to define the type
// more on recusrsive types -> https://zod.dev/?id=recursive-types
const ZSegmentFiltersInner: z.ZodType<TBaseFilters> = z
  .array(
    z.object({
      id: ZId,
      connector: ZSegmentConnector,
      resource: z.union([ZSegmentFilter, z.lazy(() => ZSegmentFiltersInner)]),
    })
  )
  .refine(refineFilters, {
    error: "Invalid filters applied",
  });

// Bounds gate + recursive parse. The bounds MUST run on the raw value before the recursive parse:
// a deep enough tree overflows the call stack inside the parse itself, throwing a RangeError that
// even safeParse does not catch — so a post-parse refine could never see it. `.pipe` short-circuits
// on failure, so the recursive inner schema never sees a tree that failed the bounds check.
export const ZSegmentFilters: z.ZodType<TBaseFilters> = z
  .unknown()
  .superRefine((raw, ctx) => {
    const violation = getSegmentFilterTreeBoundsViolation(raw);
    if (violation) {
      ctx.addIssue({ code: "custom", message: violation });
    }
  })
  .pipe(ZSegmentFiltersInner);

const ZRequiredSegmentFilters = ZSegmentFilters.refine((filters) => filters.length > 0, {
  error: "At least one filter is required",
});

/**
 * Maximum number of surveys a single segment may be linked to. The links are supplied by the client
 * (segment update, and the nested segment on a survey update) and land in a Prisma `id IN (...)`
 * lookup, so the array has to be bounded: an unbounded one is a cheap authenticated way to blow up
 * the SQL parameter payload. A saved segment reused by this many surveys is already far past any
 * shape the product produces.
 */
export const MAX_SEGMENT_SURVEYS = 500;

// `ZId` (cuid2) also keeps non-id junk from reaching the database. Ownership is still enforced at
// write time — every id must resolve to a survey in the segment's workspace (ENG-1749/ENG-1920).
// Exported so the survey draft-save path (which skips the segment schemas) can enforce the exact
// same rule before the ids drive its batched workspace lookup (ENG-2305).
export const ZSegmentSurveyIds = z.array(ZId).max(MAX_SEGMENT_SURVEYS);

export const ZSegment = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  isPrivate: z.boolean().prefault(true),
  filters: ZSegmentFilters,
  workspaceId: ZId,
  createdAt: z.date(),
  updatedAt: z.date(),
  surveys: ZSegmentSurveyIds,
});

// Minimal segment shape for the public client API — strips sensitive targeting logic
export const ZJsWorkspaceStateSegment = z.object({
  id: z.string(),
  hasFilters: z.boolean(),
});
export type TJsWorkspaceStateSegment = z.infer<typeof ZJsWorkspaceStateSegment>;

/**
 * Per-survey gate for the SDK's post-interaction segment refresh. Each flag says whether interacting
 * with THIS survey via that event can change some live survey's segment membership:
 *   - `onDisplay`  — a `Display` is created (drives `have seen` / `have not seen`)
 *   - `onResponse` — a `Response` is created (drives `have started responding to`)
 *   - `onFinished` — the response is finished (drives `have completed` / `have not completed`)
 */
export interface TSurveyInteractionRefresh {
  onDisplay: boolean;
  onResponse: boolean;
  onFinished: boolean;
}

/**
 * Maps each survey-interaction operator to the SDK callback whose event can flip a membership that
 * depends on it. Negative operators map to the SAME source as their positive counterpart — the event
 * flips the membership in the opposite direction, but a refresh is needed either way.
 */
const SURVEY_INTERACTION_OPERATOR_SOURCE: Record<
  TSurveyInteractionOperator,
  keyof TSurveyInteractionRefresh
> = {
  haveSeen: "onDisplay",
  haveNotSeen: "onDisplay",
  haveStartedRespondingTo: "onResponse",
  haveCompleted: "onFinished",
  haveNotCompleted: "onFinished",
};

/**
 * Reverse-indexes the `surveyInteraction` filters used across a workspace's live app surveys onto the
 * surveys they REFERENCE, so the SDK knows — per survey, per event — whether an interaction can change
 * any live survey's membership, and can skip the heavy post-interaction `/user` refetch otherwise.
 *
 * The flag belongs on the referenced (target) survey, not the survey that owns the filter: it is the
 * Display/Response of the *target* that flips membership. `deliveredSurveyIds` is the set the SDK can
 * actually render (and thus fire callbacks for), so bits are only ever set on surveys in that set —
 * `any` scope therefore sets the source bit on every delivered survey.
 *
 * `resolveSegmentFilters` resolves a nested `userIsIn` / `userIsNotIn` segment reference to its filter
 * tree (returns `undefined` for unknown / foreign / deleted segments, mirroring runtime evaluation),
 * so interaction filters hiding inside a referenced segment are not missed. A per-walk `visited` set
 * guards against segment-reference cycles.
 */
export const buildSurveyInteractionRefreshMap = (
  surveys: { id: string; segmentFilters: TBaseFilters | null }[],
  resolveSegmentFilters: (segmentId: string) => TBaseFilters | undefined
): { refreshBySurveyId: Record<string, TSurveyInteractionRefresh>; hasAny: boolean } => {
  const deliveredSurveyIds = surveys.map((survey) => survey.id);
  const deliveredSurveyIdSet = new Set(deliveredSurveyIds);
  const refreshBySurveyId: Record<string, TSurveyInteractionRefresh> = {};
  for (const id of deliveredSurveyIds) {
    refreshBySurveyId[id] = { onDisplay: false, onResponse: false, onFinished: false };
  }

  let hasAny = false;

  const applyLeaf = (filter: TSegmentSurveyInteractionFilter): void => {
    const source = SURVEY_INTERACTION_OPERATOR_SOURCE[filter.qualifier.operator];
    const targetIds = filter.value.surveyScope === "specific" ? filter.value.surveyIds : deliveredSurveyIds;
    for (const targetId of targetIds) {
      // Only surveys the SDK can render carry a bit; a target outside the delivered set can't fire a
      // callback, so no refresh is possible (or needed) for it.
      if (!deliveredSurveyIdSet.has(targetId)) continue;
      refreshBySurveyId[targetId][source] = true;
      hasAny = true;
    }
  };

  const walk = (filters: TBaseFilters, visited: Set<string>): void => {
    for (const group of filters) {
      const { resource } = group;
      if (Array.isArray(resource)) {
        walk(resource, visited);
      } else if (resource.root.type === "surveyInteraction") {
        applyLeaf(resource as TSegmentSurveyInteractionFilter);
      } else if (resource.root.type === "segment") {
        const { segmentId } = resource.root;
        if (visited.has(segmentId)) continue;
        visited.add(segmentId);
        const nested = resolveSegmentFilters(segmentId);
        if (nested) walk(nested, visited);
      }
    }
  };

  for (const survey of surveys) {
    if (survey.segmentFilters) {
      walk(survey.segmentFilters, new Set<string>());
    }
  }

  return { refreshBySurveyId, hasAny };
};

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
    surveys: ZSegmentSurveyIds,
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
  /**
   * Optional interaction history for evaluating `surveyInteraction` filters in the in-process
   * `evaluateSegment` path. When a segment contains a `surveyInteraction` filter and this is not
   * provided, `evaluateSegment` throws rather than silently dropping the filter (which would corrupt
   * membership). The contact-sync hot path and the Prisma preview path do not use this field — they
   * evaluate interaction filters against loaded relations / the database directly.
   */
  interactionData?: {
    displays: { surveyId: string; createdAt: Date }[];
    responses: { surveyId: string; createdAt: Date; finished: boolean }[];
  };
}
