import { z } from "zod";
import { ZId } from "./common";
import { ZSurveyQuota } from "./quota";
import { MAX_NOT_SHOWN_ID_LENGTH, ZResponseNotShown, ZResponseNotShownInput } from "./surveys/not-shown";
import { ZSurvey } from "./surveys/types";
import { ZTag } from "./tags";

const buildResponseDataValue = <TArray extends z.ZodType>(array: TArray) =>
  z.union([z.string(), z.number(), array, z.record(z.string(), z.string())]).optional();

export const ZResponseDataValue = buildResponseDataValue(z.array(z.string()));

export const ZResponseFilterCondition = z.enum([
  "accepted",
  "clicked",
  "submitted",
  "skipped",
  "equals",
  "notEquals",
  "lessThan",
  "lessEqual",
  "greaterThan",
  "greaterEqual",
  "inRange",
  "notInRange",
  "includesAll",
  "includesOne",
  "uploaded",
  "notUploaded",
  "booked",
  "isCompletelySubmitted",
  "isPartiallySubmitted",
  "isEmpty",
  "isNotEmpty",
  "isAnyOf",
  "contains",
  "doesNotContain",
  "startsWith",
  "doesNotStartWith",
  "endsWith",
  "doesNotEndWith",
]);

export type TResponseDataValue = z.infer<typeof ZResponseDataValue>;

export const ZResponseData = z.record(z.string(), ZResponseDataValue);

export type TResponseData = z.infer<typeof ZResponseData>;

export const ZResponseVariables = z.record(z.string(), z.union([z.string(), z.number()]));

export type TResponseVariables = z.infer<typeof ZResponseVariables>;

/**
 * Cardinality caps on a submitted response, per the ENG-1652 input policy. They bound the create and
 * update inputs, one request at a time: the stored schemas (`ZResponseData`, `ZResponseVariables`,
 * `ZResponseTtc`) stay unbounded, so rows written before the caps still parse.
 *
 * They are generous caps set well above what surveys hold, not limits a survey can reach by design: only
 * v3 survey writes cap a survey's size (1,000 blocks, 200 hidden fields, 100 variables), and the editor
 * and v1 survey writes do not. `data` and `ttc` have one key per answered element or hidden field, so
 * 2,000 keys covers a survey at the v3 limits with one element per block; the largest survey in
 * production has 31 blocks. A multi-select answer holds one entry per choice and a matrix one per row,
 * both far under 1,000. `variables` has one key per survey variable. The entry budget counts the whole
 * `data` map — its keys plus every array item and matrix row — so 2,000 answers can still carry 8,000
 * selections between them.
 */
export const MAX_RESPONSE_DATA_KEYS = 2_000;
export const MAX_RESPONSE_DATA_VALUES = 1_000;
export const MAX_RESPONSE_DATA_ENTRIES = 10_000;
export const MAX_RESPONSE_VARIABLE_KEYS = 500;

export const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The refusals the response caps share across API versions, so v1/v2 and v3 word them alike. */
export const RESPONSE_DATA_LIMIT_MESSAGES = {
  keys: `A response may answer at most ${MAX_RESPONSE_DATA_KEYS} fields`,
  values: `An answer may hold at most ${MAX_RESPONSE_DATA_VALUES} values`,
  rows: `A matrix answer may hold at most ${MAX_RESPONSE_DATA_VALUES} rows`,
  entries: `A response may hold at most ${MAX_RESPONSE_DATA_ENTRIES} values`,
  text: "An answer's items must be text",
  shape: "An answer must be text, a number, a list of text, or a map of text",
} as const;

/** A refusal from a size check: its message, and the path under the checked map when it names one key. */
export type TSizeCheckFailure = string | { message: string; path: string[] };

/**
 * Runs `check` on the raw input before `schema` parses it, and stops there when it fails.
 *
 * A record has no `.max()`, and a refinement only runs once Zod has parsed every key and array item —
 * reporting each bad item on its own. Checking the size first rejects an oversized map with one issue,
 * whatever its size. `z.preprocess` keeps `schema`'s output type and its OpenAPI shape; only the
 * inferred input type widens to `unknown`. A failure that names a key is reported at that key's path.
 */
export const withSizeCheck = <TSchema extends z.ZodType>(
  schema: TSchema,
  check: (record: Record<string, unknown>) => TSizeCheckFailure | undefined
) =>
  z.preprocess((value, ctx) => {
    const failure = isPlainRecord(value) ? check(value) : undefined;
    if (typeof failure === "string") ctx.addIssue({ code: "custom", message: failure });
    else if (failure) ctx.addIssue({ code: "custom", message: failure.message, path: failure.path });
    return value;
  }, schema);

/**
 * A key cap and a value check for a flat map, both run before Zod reads it. Zod reports every wrong value
 * on its own; this refuses the map at the first one, with one issue at its key.
 */
export const checkFlatMap =
  (max: number, what: string, isValue: (value: unknown) => boolean, invalid: string) =>
  (record: Record<string, unknown>): TSizeCheckFailure | undefined => {
    if (Object.keys(record).length > max) return `A response may carry at most ${max} ${what}`;
    for (const key in record) {
      if (!isValue(record[key])) return { message: invalid, path: [key] };
    }
    return undefined;
  };

const isTextOrNumber = (value: unknown) => typeof value === "string" || typeof value === "number";

const NO_ITEMS: readonly unknown[] = [];

/**
 * What one answer carries: an array's items or a matrix's row values, and nothing for a scalar. An answer
 * over its cap, or of a shape no element stores, is refused with the message for it.
 */
const itemsOfAnswer = (value: unknown): readonly unknown[] | string => {
  if (Array.isArray(value)) {
    return value.length > MAX_RESPONSE_DATA_VALUES ? RESPONSE_DATA_LIMIT_MESSAGES.values : value;
  }
  if (isPlainRecord(value)) {
    const rows = Object.values(value);
    return rows.length > MAX_RESPONSE_DATA_VALUES ? RESPONSE_DATA_LIMIT_MESSAGES.rows : rows;
  }
  return value === undefined || isTextOrNumber(value) ? NO_ITEMS : RESPONSE_DATA_LIMIT_MESSAGES.shape;
};

/**
 * The caps on a submitted answer map, checked before Zod reads it, shared by every API version that writes
 * one. Each answer is checked too: it is text, a number, a list of text or a map of text, and one wrong
 * answer or item refuses the map with one issue at that answer, instead of Zod reporting every item of
 * the union it fails. Only shape is checked here; Zod still parses what passes, so the check never lets
 * through anything the schema would refuse.
 *
 * `maxEntries` bounds the keys plus every array item and matrix row. The walk stops as soon as it is
 * spent, so it never reads more than the budget allows.
 */
export const checkResponseDataSize = (
  data: Record<string, unknown>,
  maxEntries = Number.POSITIVE_INFINITY
): TSizeCheckFailure | undefined => {
  // Keys first: on a large map walking the entries costs more than counting them, so it only runs once
  // the map is under the cap.
  const keyCount = Object.keys(data).length;
  if (keyCount > MAX_RESPONSE_DATA_KEYS) return RESPONSE_DATA_LIMIT_MESSAGES.keys;
  // The budget counts the keys too, so a map with more keys than it allows is refused before any answer.
  let entries = keyCount;
  if (entries > maxEntries) return RESPONSE_DATA_LIMIT_MESSAGES.entries;
  for (const key in data) {
    const items = itemsOfAnswer(data[key]);
    if (typeof items === "string") return { message: items, path: [key] };
    if (items.length === 0) continue;
    entries += items.length;
    if (entries > maxEntries) return RESPONSE_DATA_LIMIT_MESSAGES.entries;
    if (!items.every((item) => typeof item === "string")) {
      return { message: RESPONSE_DATA_LIMIT_MESSAGES.text, path: [key] };
    }
  }
  return undefined;
};

/** `ZResponseData` with the caps above, for the create and update inputs. */
export const ZResponseDataInput = withSizeCheck(
  z.record(z.string(), buildResponseDataValue(z.array(z.string()).max(MAX_RESPONSE_DATA_VALUES))),
  (data) => checkResponseDataSize(data, MAX_RESPONSE_DATA_ENTRIES)
);

export const ZResponseVariablesInput = withSizeCheck(
  ZResponseVariables,
  checkFlatMap(MAX_RESPONSE_VARIABLE_KEYS, "variables", isTextOrNumber, "A variable must be text or a number")
);

export const ZResponseTtc = z.record(z.string(), z.number());

export type TResponseTtc = z.infer<typeof ZResponseTtc>;

// Per-element time-to-complete (ttc, in ms) is attacker-controlled telemetry on the public
// response endpoints. We sanitize each measurement at the schema boundary: z.number() already
// rejects NaN/Infinity, and we clamp the remaining finite values into [0, MAX_RESPONSE_TTC] so
// negative or absurdly large numbers can no longer skew analytics or overflow the summed
// `_total`. Clamping rather than rejecting means a real submission is never dropped over a
// noisy timing value — a question is only briefly "active", so anything past a day is
// meaningless rather than a reason to reject the response. Stored/returned responses keep the
// unbounded ZResponseTtc so historical data still parses. One entry per element, so it shares the
// response's key cap.
export const MAX_RESPONSE_TTC = 1000 * 60 * 60 * 24; // 24 hours per element

export const ZResponseTtcInput = withSizeCheck(
  z.record(
    z.string(),
    z.number().transform((value) => Math.min(Math.max(value, 0), MAX_RESPONSE_TTC))
  ),
  checkFlatMap(
    MAX_RESPONSE_DATA_KEYS,
    "timing entries",
    (value) => typeof value === "number",
    "A timing entry must be a number"
  )
);

export type TResponseTtcInput = z.infer<typeof ZResponseTtcInput>;

export const ZResponseContactAttributes = z.record(z.string(), z.string()).nullable();

export type TResponseContactAttributes = z.infer<typeof ZResponseContactAttributes>;

export const ZSurveyContactAttributes = z.record(z.string(), z.array(z.string()));

export type TSurveyContactAttributes = z.infer<typeof ZSurveyContactAttributes>;

export const ZSurveyMetaFieldFilter = z.record(z.string(), z.array(z.string()));

export type TSurveyMetaFieldFilter = z.infer<typeof ZSurveyMetaFieldFilter>;

export const ZResponseHiddenFieldsFilter = z.record(z.string(), z.array(z.string()));

export type TResponseHiddenFieldsFilter = z.infer<typeof ZResponseHiddenFieldsFilter>;

// Comparison values are numbers for number-typed fields, ISO-8601 strings for date-typed ones —
// jsonb compares same-format ISO strings lexicographically, which is chronological (ENG-1848).
const ZResponseFilterCriteriaDataLessThan = z.object({
  op: z.literal(ZResponseFilterCondition.enum.lessThan),
  value: z.union([z.number(), z.string()]),
});

const ZResponseFilterCriteriaDataLessEqual = z.object({
  op: z.literal(ZResponseFilterCondition.enum.lessEqual),
  value: z.union([z.number(), z.string()]),
});

const ZResponseFilterCriteriaDataGreaterEqual = z.object({
  op: z.literal(ZResponseFilterCondition.enum.greaterEqual),
  value: z.union([z.number(), z.string()]),
});

const ZResponseFilterCriteriaDataGreaterThan = z.object({
  op: z.literal(ZResponseFilterCondition.enum.greaterThan),
  value: z.union([z.number(), z.string()]),
});

/**
 * Response filters are client-supplied and every entry below is expanded into Prisma filter clauses
 * by buildWhereClause, so unbounded arrays and records are a denial-of-service vector (ENG-3161).
 * These caps are defence in depth behind that builder's own clause budget — deliberately far above
 * any real survey, since the budget is what makes the cost provably finite.
 */
const MAX_FILTER_VALUES = 1_000;
const MAX_FILTER_KEYS = 500;

/**
 * A half-open `[min, max)` window over the stored value — `min` matches, `max` does not.
 *
 * It exists because a date-typed field is filtered at a coarser granularity than it is stored: the
 * response filter's date input emits a day (`2026-09-01`) while the column holds whatever arrived,
 * which is a day *or* an instant on it (`2026-09-01T10:30:00Z`). "On 2026-09-01" is therefore a
 * range over the instants of that day rather than an equality, and one condition per key is all the
 * grammar can carry — so the range is the condition (ENG-3232). `buildDateFieldCondition` is the
 * only producer; `buildWhereClause` expands it into `gte`/`lt`.
 *
 * Both bounds are written in the same ISO spelling as the stored values, which is what lets a single
 * lexicographic window cover both stored forms: `"2026-09-01" <= "2026-09-01T10:30:00Z" <
 * "2026-09-02"` holds as text exactly as it does in time.
 */
const ZResponseFilterCriteriaDataInRange = z.object({
  op: z.literal(ZResponseFilterCondition.enum.inRange),
  min: z.string(),
  max: z.string(),
});

/** The complement of {@link ZResponseFilterCriteriaDataInRange}; an absent value matches, as with `notEquals`. */
const ZResponseFilterCriteriaDataNotInRange = z.object({
  op: z.literal(ZResponseFilterCondition.enum.notInRange),
  min: z.string(),
  max: z.string(),
});

const ZResponseFilterCriteriaDataIncludesOne = z.object({
  op: z.literal(ZResponseFilterCondition.enum.includesOne),
  value: z.union([z.array(z.string()).max(MAX_FILTER_VALUES), z.array(z.number()).max(MAX_FILTER_VALUES)]),
});

const ZResponseFilterCriteriaDataIncludesAll = z.object({
  op: z.literal(ZResponseFilterCondition.enum.includesAll),
  value: z.array(z.string()).max(MAX_FILTER_VALUES),
});

// An equality value is compared against the value as it is *stored*, so there is no boolean member:
// a boolean-typed Embedded Data field stores the strings "true" / "false", never a jsonb boolean.
// ZResponseDataValue has no boolean member, so `normalizeBoolean` canonicalizes onto those two
// spellings at ingest and `coerceToEmbeddedDataType` reads them back — and neither `variables`
// (string | number) nor `meta` can hold one either. A jsonb boolean here could therefore only ever
// describe a condition that matches no row, which is exactly what it did (ENG-3231).
const ZResponseFilterCriteriaDataEquals = z.object({
  op: z.literal(ZResponseFilterCondition.enum.equals),
  value: z.union([z.string(), z.number()]),
});

const ZResponseFilterCriteriaDataNotEquals = z.object({
  op: z.literal(ZResponseFilterCondition.enum.notEquals),
  value: z.union([z.string(), z.number()]),
});

const ZResponseFilterCriteriaDataAccepted = z.object({
  op: z.literal(ZResponseFilterCondition.enum.accepted),
});

const ZResponseFilterCriteriaDataClicked = z.object({
  op: z.literal(ZResponseFilterCondition.enum.clicked),
});

const ZResponseFilterCriteriaDataSubmitted = z.object({
  op: z.literal(ZResponseFilterCondition.enum.submitted),
});

const ZResponseFilterCriteriaDataSkipped = z.object({
  op: z.literal(ZResponseFilterCondition.enum.skipped),
});

const ZResponseFilterCriteriaDataUploaded = z.object({
  op: z.literal(ZResponseFilterCondition.enum.uploaded),
});

const ZResponseFilterCriteriaDataNotUploaded = z.object({
  op: z.literal(ZResponseFilterCondition.enum.notUploaded),
});

const ZResponseFilterCriteriaDataBooked = z.object({
  op: z.literal(ZResponseFilterCondition.enum.booked),
});

const ZResponseFilterCriteriaMatrix = z.object({
  op: z.literal("matrix"),
  value: z.record(z.string(), z.string()),
});

const ZResponseFilterCriteriaIsEmpty = z.object({
  op: z.literal(ZResponseFilterCondition.enum.isEmpty),
});

const ZResponseFilterCriteriaIsNotEmpty = z.object({
  op: z.literal(ZResponseFilterCondition.enum.isNotEmpty),
});

const ZResponseFilterCriteriaIsAnyOf = z.object({
  op: z.literal(ZResponseFilterCondition.enum.isAnyOf),
  value: z.record(z.string(), z.array(z.string())),
});

const ZResponseFilterCriteriaContains = z.object({
  op: z.literal(ZResponseFilterCondition.enum.contains),
  value: z.string(),
});

const ZResponseFilterCriteriaDoesNotContain = z.object({
  op: z.literal(ZResponseFilterCondition.enum.doesNotContain),
  value: z.string(),
});

const ZResponseFilterCriteriaStartsWith = z.object({
  op: z.literal(ZResponseFilterCondition.enum.startsWith),
  value: z.string(),
});

const ZResponseFilterCriteriaDoesNotStartWith = z.object({
  op: z.literal(ZResponseFilterCondition.enum.doesNotStartWith),
  value: z.string(),
});

const ZResponseFilterCriteriaEndsWith = z.object({
  op: z.literal(ZResponseFilterCondition.enum.endsWith),
  value: z.string(),
});

const ZResponseFilterCriteriaDoesNotEndWith = z.object({
  op: z.literal(ZResponseFilterCondition.enum.doesNotEndWith),
  value: z.string(),
});

const ZResponseFilterCriteriaFilledOut = z.object({
  op: z.literal("filledOut"),
});

const ZResponseFilterCriteriaIsSet = z.object({
  op: z.literal("isSet"),
});

const ZResponseFilterCriteriaIsNotSet = z.object({
  op: z.literal("isNotSet"),
});

/**
 * Condition grammar for the typed Embedded Data + reserved-field filter groups (ENG-1848). One
 * union serves both groups: which subset a field actually offers is decided by its `dataType` at
 * the UI (string → equality + text ops, number → equality + comparisons, date → equality +
 * before/after over ISO strings), and `buildWhereClause` only translates.
 *
 * A date-typed field is the exception to "the UI picks the op": its *value* decides too, because a
 * day-granular value cannot be compared to a stored instant by equality. `buildDateFieldCondition`
 * rewrites those rows onto the range members below (ENG-3232).
 */
const ZTypedFieldFilterCondition = z.union([
  ZResponseFilterCriteriaDataEquals,
  ZResponseFilterCriteriaDataNotEquals,
  ZResponseFilterCriteriaContains,
  ZResponseFilterCriteriaDoesNotContain,
  ZResponseFilterCriteriaStartsWith,
  ZResponseFilterCriteriaDoesNotStartWith,
  ZResponseFilterCriteriaEndsWith,
  ZResponseFilterCriteriaDoesNotEndWith,
  ZResponseFilterCriteriaDataLessThan,
  ZResponseFilterCriteriaDataLessEqual,
  ZResponseFilterCriteriaDataGreaterEqual,
  ZResponseFilterCriteriaDataGreaterThan,
  ZResponseFilterCriteriaDataInRange,
  ZResponseFilterCriteriaDataNotInRange,
  ZResponseFilterCriteriaIsSet,
  ZResponseFilterCriteriaIsNotSet,
]);

const ZQuotasFilterCriteriaScreenedIn = z.object({
  op: z.literal("screenedIn"),
});

const ZQuotasFilterCriteriaScreenedOut = z.object({
  op: z.literal("screenedOut"),
});

const ZQuotasFilterCriteriaScreenedOutNotInQuota = z.object({
  op: z.literal("screenedOutNotInQuota"),
});

/**
 * A reviewer's verdict on a response (ENG-6780). Mirrors the `ResponseOutcome` database enum; a response
 * with no verdict carries `null`, which is not a value of this enum. Marking never deletes: every count,
 * list, webhook and integration still includes the response.
 */
export const ZResponseOutcome = z.enum(["lowQuality"]);
export type TResponseOutcome = z.infer<typeof ZResponseOutcome>;

/** A block, element, option, row or column id a shown / not shown filter names. */
const ZResponseFilterShownId = z.string().min(1).max(MAX_NOT_SHOWN_ID_LENGTH);

/**
 * Shown / not shown (ENG-6951): whether a response's not-shown record (ADR 0024) says the respondent
 * was shown a block, an element, or an element's option, matrix row or matrix column.
 *
 * - `notShown`: the record lists the target, or the element or block holding it.
 * - `shown`: the respondent reached it and it was not hidden. The record lists neither the target nor
 *   what holds it, and the element (for a block: one of its elements) has an answer or a time entry,
 *   which the survey writes for every element on a page the respondent submitted.
 *
 * A response with no record (`notShown` null: collected before 6.2 or by an older cached survey) is
 * unknown and matches neither.
 */
const ZResponseFilterShownOp = z.enum(["shown", "notShown"]);

export const ZResponseFilterCriteriaShown = z.discriminatedUnion("target", [
  z.object({ target: z.literal("block"), blockId: ZResponseFilterShownId, op: ZResponseFilterShownOp }),
  z.object({ target: z.literal("element"), elementId: ZResponseFilterShownId, op: ZResponseFilterShownOp }),
  z.object({
    target: z.literal("option"),
    elementId: ZResponseFilterShownId,
    itemId: ZResponseFilterShownId,
    op: ZResponseFilterShownOp,
  }),
  z.object({
    target: z.literal("row"),
    elementId: ZResponseFilterShownId,
    itemId: ZResponseFilterShownId,
    op: ZResponseFilterShownOp,
  }),
  z.object({
    target: z.literal("column"),
    elementId: ZResponseFilterShownId,
    itemId: ZResponseFilterShownId,
    op: ZResponseFilterShownOp,
  }),
]);

export type TResponseFilterCriteriaShown = z.infer<typeof ZResponseFilterCriteriaShown>;

/** One condition on a `data` key: a question, or an ingested field under its storage key. */
const ZResponseFilterCriteriaDataCondition = z.union([
  ZResponseFilterCriteriaDataLessThan,
  ZResponseFilterCriteriaDataLessEqual,
  ZResponseFilterCriteriaDataGreaterEqual,
  ZResponseFilterCriteriaDataGreaterThan,
  // An ingested date field filters through `data` under its storage key, so the day window a
  // date-only filter value means has to be expressible here too (ENG-3232).
  ZResponseFilterCriteriaDataInRange,
  ZResponseFilterCriteriaDataNotInRange,
  ZResponseFilterCriteriaDataIncludesOne,
  ZResponseFilterCriteriaDataIncludesAll,
  ZResponseFilterCriteriaDataEquals,
  ZResponseFilterCriteriaDataNotEquals,
  ZResponseFilterCriteriaDataAccepted,
  ZResponseFilterCriteriaDataClicked,
  ZResponseFilterCriteriaDataSubmitted,
  ZResponseFilterCriteriaDataSkipped,
  ZResponseFilterCriteriaDataUploaded,
  ZResponseFilterCriteriaDataNotUploaded,
  ZResponseFilterCriteriaDataBooked,
  ZResponseFilterCriteriaMatrix,
  ZResponseFilterCriteriaIsEmpty,
  ZResponseFilterCriteriaIsNotEmpty,
  ZResponseFilterCriteriaIsAnyOf,
  ZResponseFilterCriteriaFilledOut,
  // Text ops for string-typed ingested Embedded Data fields, which filter through `data`
  // under their storage key (ENG-1848).
  ZResponseFilterCriteriaContains,
  ZResponseFilterCriteriaDoesNotContain,
  ZResponseFilterCriteriaStartsWith,
  ZResponseFilterCriteriaDoesNotStartWith,
  ZResponseFilterCriteriaEndsWith,
  ZResponseFilterCriteriaDoesNotEndWith,
]);

const ZResponseFilterCriteriaFields = z.object({
  finished: z.boolean().optional(),
  /** Only responses carrying this outcome. Absent means no constraint, not "without an outcome". */
  outcome: ZResponseOutcome.optional(),
  /**
   * Only responses without an outcome: the export's "leave Low quality out". Ignored when `outcome` selects
   * one. Set by the export route, never by the Responses filter.
   */
  excludeLowQuality: z.boolean().optional(),
  responseIds: z.array(ZId).optional(),
  createdAt: z
    .object({
      min: z.date().optional(),
      max: z.date().optional(),
    })
    .optional(),

  contactAttributes: z
    .record(
      z.string(),
      z.object({
        op: z.enum(["equals", "notEquals"]),
        value: z.union([z.string(), z.number()]),
      })
    )
    .optional(),

  data: z.record(z.string(), ZResponseFilterCriteriaDataCondition).optional(),

  /**
   * Further conditions on keys `data` already holds, all ANDed with it: a range on one question is
   * two rules ("> 1" and "< 5"), and `data` keeps one condition per key.
   */
  dataAnd: z
    .array(z.object({ key: z.string(), condition: ZResponseFilterCriteriaDataCondition }))
    .max(MAX_FILTER_KEYS)
    .optional(),

  /**
   * Typed filters on Embedded Data + reserved fields (ENG-1848).
   * - `variables`: computed embedded fields, keyed by storageKey (values live in `Response.variables`).
   * - `reserved`: reserved catalog fields, keyed by catalog entry name (`utmSource`, `deviceType`, …).
   *   The name→storage-path mapping is owned by `buildWhereClause`, which also drops names the
   *   survey's declared fields shadow — filters fail closed, consistent with recall/logic.
   */
  variables: z.record(z.string(), ZTypedFieldFilterCondition).optional(),
  reserved: z.record(z.string(), ZTypedFieldFilterCondition).optional(),

  tags: z
    .object({
      // `applied` expands to one relation subquery per tag in createFilterTags, so it carries the
      // same clause-expansion risk as the data filters above.
      applied: z.array(z.string()).max(MAX_FILTER_VALUES).optional(),
      notApplied: z.array(z.string()).max(MAX_FILTER_VALUES).optional(),
      // "Tagged with any of": the Responses quick filter ticks several tags and means either.
      appliedAny: z.array(z.string()).max(MAX_FILTER_VALUES).optional(),
    })
    .optional(),

  others: z
    .record(
      z.string(),
      z.union([
        z.object({
          op: z.enum(["equals", "notEquals"]),
          value: z.union([z.string(), z.number()]),
        }),
        // "Language is any of": the Responses quick filter ticks several languages at once.
        z.object({ op: z.literal("in"), value: z.array(z.string()).min(1).max(MAX_FILTER_VALUES) }),
      ])
    )
    .optional(),

  meta: z
    .record(
      z.string(),
      z.union([
        ZResponseFilterCriteriaDataEquals,
        ZResponseFilterCriteriaDataNotEquals,
        ZResponseFilterCriteriaContains,
        ZResponseFilterCriteriaDoesNotContain,
        ZResponseFilterCriteriaStartsWith,
        ZResponseFilterCriteriaDoesNotStartWith,
        ZResponseFilterCriteriaEndsWith,
        ZResponseFilterCriteriaDoesNotEndWith,
      ])
    )
    .optional(),

  quotas: z
    .record(
      ZId,
      z.union([
        ZQuotasFilterCriteriaScreenedIn,
        ZQuotasFilterCriteriaScreenedOut,
        ZQuotasFilterCriteriaScreenedOutNotInQuota,
      ])
    )
    .optional(),

  /** Shown / not shown conditions on the not-shown record (ENG-6951), all ANDed. */
  shown: z.array(ZResponseFilterCriteriaShown).max(MAX_FILTER_KEYS).optional(),
});

/**
 * Every record field above is iterated per key by buildWhereClause, so an unbounded key count
 * multiplies the filter clauses it emits. z.record carries no size check in Zod 4, hence the
 * refinement — kept separate from the shape so the object literal stays untouched.
 */
export const ZResponseFilterCriteria = ZResponseFilterCriteriaFields.refine(
  (criteria) =>
    [
      criteria.contactAttributes,
      criteria.data,
      criteria.reserved,
      criteria.variables,
      criteria.others,
      criteria.meta,
      criteria.quotas,
    ].every((record) => !record || Object.keys(record).length <= MAX_FILTER_KEYS),
  { error: `A response filter may not carry more than ${MAX_FILTER_KEYS} conditions per field` }
);

export const ZResponseContact = z.object({
  id: ZId,
  userId: z.string().optional(),
});

export type TResponseContact = z.infer<typeof ZResponseContact>;

export type TResponseFilterCriteria = z.infer<typeof ZResponseFilterCriteria>;

/**
 * The browser-runtime context the survey renderer snapshots once, at display time, and attaches to
 * every write of the response (ENG-1841). Kept as its own schema because three shapes need exactly
 * this set of keys and must not drift: the stored `ZResponseMeta`, the ingest input
 * `ZResponseInput.meta`, and the renderer-to-queue `ZResponseUpdate.meta`.
 *
 * Every key is optional, and deliberately so on two counts. Responses collected before this shipped
 * carry none of them and must keep validating — there is no migration and nothing to backfill, since
 * the values only ever existed in a browser that has long since closed. And a live capture is
 * best-effort per key: a runtime without `Intl` or `screen` omits that key rather than storing a
 * placeholder, so "absent" always reads as "we could not observe this", never as an empty string.
 *
 * Both link and app surveys render through the same component, so all of these are captured for
 * both. Their *meaning* differs: on a link survey they describe the Formbricks-hosted survey page
 * and how the respondent arrived at it; on an app survey they describe the host page the survey was
 * triggered on.
 */
export const ZAutoCapturedResponseMeta = z.object({
  /** `location.pathname` — the query-free page identity analytics usually groups on. */
  pagePath: z.string().optional(),
  /** `document.referrer`. Empty when there is no referrer, which we omit rather than store as "". */
  pageReferrer: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
  /** Physical screen, in CSS pixels (`screen.width`/`screen.height`). */
  screenWidth: z.number().optional(),
  screenHeight: z.number().optional(),
  /** Visible viewport, in CSS pixels (`window.innerWidth`/`innerHeight`). Frozen at display. */
  viewportWidth: z.number().optional(),
  viewportHeight: z.number().optional(),
  /** IANA zone from `Intl.DateTimeFormat().resolvedOptions().timeZone`, e.g. `Europe/Berlin`. */
  timezone: z.string().optional(),
  /**
   * The device's configured locale from `navigator.language`, e.g. `de-AT`. Not validated as a BCP-47
   * tag: what the runtime reports is the finding, and rejecting an unusual tag would store nothing
   * rather than something imperfect.
   */
  locale: z.string().optional(),
  /*
   * The visit so far, from the web SDK's visit store (ENG-3926): app surveys on websites only, so
   * link surveys and mobile apps never carry them. A visit is one browser tab.
   */
  visitPagesViewed: z.number().optional(),
  visitUniquePagesViewed: z.number().optional(),
  /** Seconds spent on the site's own pages in this visit; time on other sites is left out. */
  visitTimeOnSite: z.number().optional(),
  /** `document.referrer` of the visit's first page. */
  visitEntryReferrer: z.string().optional(),
  /** The pages taken in order, as paths joined by `VISIT_URLS_SEPARATOR` from `./visit` (last 50, first kept). */
  visitUrls: z.string().optional(),
});

export type TAutoCapturedResponseMeta = z.infer<typeof ZAutoCapturedResponseMeta>;

export const ZResponseMeta = ZAutoCapturedResponseMeta.extend({
  source: z.string().optional(),
  url: z.string().optional(),
  userAgent: z
    .object({
      browser: z.string().optional(),
      os: z.string().optional(),
      device: z.string().optional(),
    })
    .optional(),
  country: z.string().optional(),
  action: z.string().optional(),
  ipAddress: z.string().optional(),
  /**
   * The creative that opened the survey. A client asks with the id; the ingest routes
   * keep it only after checking the creative is in the workspace and opens this survey, and stamp the
   * name themselves — a client-sent name never reaches the database. The name is the one the creative
   * had when the response was created, so a later rename leaves stored responses as they were.
   */
  // Anything but text is dropped rather than refusing the response (the routes check the id anyway).
  openedByCreativeId: z.string().optional().catch(undefined),
  openedByCreativeName: z.string().optional(),
});

export type TResponseMeta = z.infer<typeof ZResponseMeta>;

/**
 * The client-supplied half of `meta`, narrowed to exactly the auto-captured keys.
 *
 * Both client ingest routes rebuild `meta` from scratch rather than passing the caller's object
 * through, because these endpoints are public and anything not explicitly re-listed must not reach
 * the database. That whitelist is hand-written in the route, which is how a field could be added to
 * the schema, captured by the SDK, accepted by the parser — and then silently dropped one line
 * before the write. Deriving this part of it from the schema instead means the auto-captured list
 * cannot fall behind the shape it is supposed to mirror.
 *
 * Only the keys a browser can honestly observe live here. `country`, `userAgent` and `ipAddress`
 * stay out: the routes derive those from the request itself and must keep overriding whatever the
 * client claimed.
 */
export const pickAutoCapturedResponseMeta = (meta: TResponseMeta | undefined): TAutoCapturedResponseMeta =>
  ZAutoCapturedResponseMeta.parse(meta ?? {});

export const ZResponse = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  surveyId: z.cuid2(),
  displayId: z.string().nullish(),
  contact: ZResponseContact.nullable(),
  contactAttributes: ZResponseContactAttributes,
  finished: z.boolean(),
  endingId: z.string().nullish(),
  data: ZResponseData,
  variables: ZResponseVariables,
  ttc: ZResponseTtc.optional(),
  tags: z.array(ZTag),
  meta: ZResponseMeta,
  singleUseId: z.string().nullable(),
  language: z.string().nullable(),
  // `nullish` so a snapshot built before the column existed (a queued job, a fixture) still parses;
  // every select reads the column, so a live response always carries it, `null` when unset.
  outcome: ZResponseOutcome.nullish(),
});

export type TResponse = z.infer<typeof ZResponse>;

export const ZResponseInput = z.object({
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  workspaceId: z.cuid2(),
  surveyId: z.cuid2(),
  userId: z.string().nullish(),
  displayId: z.string().nullish(),
  singleUseId: z.string().nullable().optional(),
  pinAuthToken: z.string().nullish(),
  // The survey client already sends this on every create (see `response-queue.ts`), but it used to be
  // absent from this schema, so Zod stripped it before the v1 handler could enforce the reCAPTCHA gate.
  recaptchaToken: z.string().nullish(),
  finished: z.boolean(),
  endingId: z.string().nullish(),
  language: z.string().optional(),
  data: ZResponseDataInput,
  variables: ZResponseVariablesInput.optional(),
  ttc: ZResponseTtcInput.optional(),
  // The same shape as the stored `ZResponseMeta`, and now literally it: this used to be a hand-copied
  // duplicate, which is how a field added to one could pass review and still fail to parse on the way
  // in. The ingest routes rebuild `meta` from a whitelist afterwards, so accepting a key here is not
  // the same as trusting it — `country`, `userAgent` and `ipAddress` are always re-derived server-side.
  meta: ZResponseMeta.optional(),
});

export type TResponseInput = z.infer<typeof ZResponseInput>;

/**
 * Mark as low quality from the survey (ENG-6933, ADR 0022/0024): a rule's action asks the server to set the
 * response's outcome to Low quality, with the create or update that follows it. The flag is one way: only
 * `true` is accepted, it never clears an outcome and sets no other value. The server sets the outcome and
 * queues the Hub reconcile, exactly as a reviewer marking the response does.
 *
 * Only the client response routes take it, so it lives on the client inputs below and not on
 * `ZResponseInput` / `ZResponseUpdateInput`, which the management APIs share and document.
 */
export const ZResponseMarkLowQuality = z.literal(true);

/**
 * The survey's create input on the public client routes (`POST /api/v1|v2/client/{workspaceId}/responses`):
 * `ZResponseInput` plus the Mark as low quality flag (ENG-6933) and the not-shown record (ENG-6936). Kept off
 * `ZResponseInput` itself, which the v1 and v2 management APIs also parse, so their contracts stay as they are.
 */
export const ZClientResponseInput = ZResponseInput.extend({
  markLowQuality: ZResponseMarkLowQuality.optional(),
  notShown: ZResponseNotShownInput.optional(),
});

export type TClientResponseInput = z.infer<typeof ZClientResponseInput>;

export const ZResponseUpdateInput = z.object({
  finished: z.boolean().optional(),
  endingId: z.string().nullish(),
  data: ZResponseDataInput.optional(),
  variables: ZResponseVariablesInput.optional(),
  ttc: ZResponseTtcInput.optional(),
  language: z.string().optional(),
  pinAuthToken: z.string().nullish(),
});

export type TResponseUpdateInput = z.infer<typeof ZResponseUpdateInput>;

/**
 * The survey's update input on the public client route
 * (`PUT /api/v1|v2/client/{workspaceId}/responses/{responseId}`): `ZResponseUpdateInput` plus the Mark as
 * low quality flag (ENG-6933) and the not-shown record (ENG-6936). The survey sends the whole current
 * not-shown record with every update; the server replaces the stored one with it and removes the answers
 * it lists. Kept off `ZResponseUpdateInput`, which the management APIs also parse.
 */
export const ZClientResponseUpdateInput = ZResponseUpdateInput.extend({
  markLowQuality: ZResponseMarkLowQuality.optional(),
  notShown: ZResponseNotShownInput.optional(),
});

export type TClientResponseUpdateInput = z.infer<typeof ZClientResponseUpdateInput>;

export const ZResponseWithSurvey = ZResponse.extend({
  survey: ZSurvey,
});

export type TResponseWithSurvey = z.infer<typeof ZResponseWithSurvey>;

export const ZResponseHiddenFieldValue = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.array(z.string())])
);
export type TResponseHiddenFieldValue = z.infer<typeof ZResponseHiddenFieldValue>;

export const ZResponseUpdate = z.object({
  finished: z.boolean(),
  data: ZResponseData,
  language: z.string().optional(),
  variables: ZResponseVariables.optional(),
  ttc: ZResponseTtcInput.optional(),
  // Only what a browser can actually observe. The server-derived keys (`country`, `userAgent`,
  // `ipAddress`) stay out on purpose: this is the renderer-to-queue shape, and the renderer has no
  // business claiming a value the ingest route derives from the request itself.
  meta: ZAutoCapturedResponseMeta.extend({
    url: z.string().optional(),
    source: z.string().optional(),
    action: z.string().optional(),
    // The id only: the ingest routes check it and stamp the name (ENG-4001).
    openedByCreativeId: z.string().optional(),
  }).optional(),
  // `ZResponseData`, not the narrower `ZResponseHiddenFieldValue`: `ResponseQueue` merges this map
  // over `data` on every submit, so `data`'s value shape is literally its type. The renderer now
  // sends the record the ingest contract produced (ENG-1845), which — like `data` — can carry a
  // question answer's shape for a key that collided with an element id.
  hiddenFields: ZResponseData.optional(),
  displayId: z.string().nullish(),
  endingId: z.string().nullish(),
  // A rule marked the response Low quality on this submit (ENG-6933). Sent with this write and kept by
  // the accumulated response, so a create built from it carries the flag too.
  markLowQuality: ZResponseMarkLowQuality.optional(),
  /** The whole current not-shown record (ENG-6936), sent with every create and update. */
  notShown: ZResponseNotShownInput.optional(),
});

export type TResponseUpdate = z.infer<typeof ZResponseUpdate>;

export const ZResponseTableData = z.object({
  responseId: z.string(),
  singleUseId: z.string().nullable(),
  createdAt: z.date(),
  status: z.string(),
  verifiedEmail: z.string(),
  tags: z.array(ZTag),
  language: z.string().nullable(),
  responseData: ZResponseData,
  variables: z.record(z.string(), z.union([z.string(), z.number()])),
  person: ZResponseContact.nullable(),
  contactAttributes: ZResponseContactAttributes,
  meta: ZResponseMeta,
  /**
   * Reserved-field values already resolved and rendered, keyed by column id (ENG-2540). Precomputed
   * on the row like `variables` and `responseData`, rather than read out of `meta` by a per-column
   * switch: resolution belongs to the catalog's own accessors, which apply the `redactQuery` policy
   * and the dataType coercion, and `meta` alone cannot express a field that is not stored under its
   * own name (`deviceType` lives at `meta.userAgent.device`).
   */
  reservedValues: z.record(z.string(), z.string()),
  quotas: z.array(z.string()).optional(),
  outcome: ZResponseOutcome.nullish(),
});

export type TResponseTableData = z.infer<typeof ZResponseTableData>;

export const ZResponseWithQuotas = ZResponse.extend({
  quotas: z.array(ZSurveyQuota.pick({ id: true, name: true })).optional(),
  /**
   * What the respondent was not shown (ENG-6936, ADR 0024); `null` means unknown. Read only for the
   * app's own results (the responses page and the response card): it is not on `ZResponse`, and the
   * shared response selection leaves it out, so webhooks, integrations and the v1/v2 payloads stay
   * exactly as before.
   */
  notShown: ZResponseNotShown.nullish(),
});

export type TResponseWithQuotas = z.infer<typeof ZResponseWithQuotas>;
