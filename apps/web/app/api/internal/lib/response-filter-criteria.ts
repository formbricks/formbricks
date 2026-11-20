import { z } from "zod";
import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import {
  FILTER_TEXT_MAX_LENGTH,
  IDENTIFIER_MAX_LENGTH,
  PICKED_ITEMS_MAX,
} from "@/app/api/internal/lib/limits";
import { checkEntriesMax, checkStringMax, isPlainRecord } from "@/app/api/internal/lib/value-bounds";
import { ZResponseFilterCriteriaJson } from "@/lib/response/filter-criteria-json";

type TPath = (string | number)[];

/** The criteria fields keyed by what they filter on: a question or field id, an attribute, a meta key. */
const KEYED_FIELDS = ["data", "contactAttributes", "variables", "reserved", "others", "meta"] as const;

/**
 * A key a filter names is longer than an identifier: the issue names the field it sits in, since the key
 * is the oversized input itself.
 */
const checkKey = (ctx: z.RefinementCtx, key: string, path: TPath): void => {
  if (key.length <= IDENTIFIER_MAX_LENGTH) return;
  ctx.addIssue({
    code: "too_big",
    origin: "string",
    maximum: IDENTIFIER_MAX_LENGTH,
    inclusive: true,
    input: key,
    path,
    message: `Too big: expected key to have <=${IDENTIFIER_MAX_LENGTH} characters`,
  });
};

/**
 * Every string inside one parsed condition, keys of its nested records included, gets the filter-text cap.
 * Conditions are a fixed few levels deep (a matrix's row record, an `isAnyOf` record of option lists), so
 * the recursion is bounded by the shared schema that already parsed them.
 */
const checkConditionText = (value: unknown, path: TPath, ctx: z.RefinementCtx): void => {
  if (typeof value === "string") {
    checkStringMax(ctx, value, FILTER_TEXT_MAX_LENGTH, path);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => checkConditionText(item, [...path, index], ctx));
  } else if (isPlainRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      checkStringMax(ctx, key, FILTER_TEXT_MAX_LENGTH, path);
      checkConditionText(child, [...path, key], ctx);
    }
  }
};

/** One condition: its text capped, and an `isAnyOf` limited to as many questions as a form can pick. */
const checkCondition = (condition: unknown, path: TPath, ctx: z.RefinementCtx): void => {
  if (isPlainRecord(condition) && condition.op === "isAnyOf" && isPlainRecord(condition.value)) {
    checkEntriesMax(ctx, condition.value, PICKED_ITEMS_MAX, [...path, "value"]);
  }
  checkConditionText(condition, path, ctx);
};

/**
 * Bounds a parsed filter's free-form fields (CODING_STANDARDS.md "Input Limits"). The shared
 * `ZResponseFilterCriteria` already caps how many conditions and values a filter carries; this caps their
 * size: a key a filter names at the identifier cap, every compared value at the filter-text cap.
 */
const checkResponseFilterCriteria = (criteria: TResponseFilterCriteria, ctx: z.RefinementCtx): void => {
  for (const field of KEYED_FIELDS) {
    const record = criteria[field];
    if (!record) continue;
    for (const [key, condition] of Object.entries(record)) {
      checkKey(ctx, key, [field]);
      checkCondition(condition, [field, key], ctx);
    }
  }
  criteria.dataAnd?.forEach(({ key, condition }, index) => {
    checkStringMax(ctx, key, IDENTIFIER_MAX_LENGTH, ["dataAnd", index, "key"]);
    checkCondition(condition, ["dataAnd", index, "condition"], ctx);
  });
  if (criteria.tags) checkConditionText(criteria.tags, ["tags"], ctx);
};

/** A response filter read from a JSON body (`ZResponseFilterCriteriaJson`), its keys and values bounded. */
export const ZResponseFilterCriteriaBody =
  ZResponseFilterCriteriaJson.superRefine(checkResponseFilterCriteria);
