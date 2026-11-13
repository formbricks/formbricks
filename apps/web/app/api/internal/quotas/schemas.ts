import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZSurveyQuotaInput, ZSurveyQuotaLogic } from "@formbricks/types/quota";
import { type TSingleCondition, ZSingleCondition } from "@formbricks/types/surveys/logic";
import { FILTER_TEXT_MAX_LENGTH, IDENTIFIER_MAX_LENGTH } from "@/app/api/internal/lib/limits";
import { checkEntriesMax, checkStringMax } from "@/app/api/internal/lib/value-bounds";

/** Longest quota name a write may set: far above any name the editor's field shows in full. */
export const QUOTA_NAME_MAX_LENGTH = 255;

/** Largest quota limit: the `Int` column's ceiling, past which the write would fail with a 500. */
export const QUOTA_LIMIT_MAX = 2_147_483_647;

/** Entries in a condition operand's `meta` (a matrix row and its id): far above any the editor writes. */
export const QUOTA_OPERAND_META_MAX_ENTRIES = 50;

/** The keys a quota condition has (`ZSingleCondition`). */
const QUOTA_CONDITION_KEYS = new Set(["id", "leftOperand", "operator", "rightOperand", "connector"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A quota condition, refusing keys it doesn't have. `ZSingleCondition` is an intersection with records in
 * its operands, which `strictDeep` cannot rebuild, so the unknown-key check runs on the condition itself;
 * the operands below it keep the shared schema's rules.
 */
const ZQuotaCondition = z.preprocess((value, ctx) => {
  if (isRecord(value)) {
    const unknownKeys = Object.keys(value).filter((key) => !QUOTA_CONDITION_KEYS.has(key));
    if (unknownKeys.length > 0) ctx.addIssue({ code: "unrecognized_keys", keys: unknownKeys, input: value });
  }
  return value;
}, ZSingleCondition);

/**
 * Bounds a parsed condition's free-form fields (CODING_STANDARDS.md "Input Limits"). The operands are
 * unions inside an intersection, which can't be rebuilt with caps, so they are checked once parsed: ids an
 * operand names get the identifier cap, a static value the filter-text cap.
 */
const checkQuotaCondition = (
  { leftOperand, rightOperand }: TSingleCondition,
  path: (string | number)[],
  ctx: z.RefinementCtx
): void => {
  checkStringMax(ctx, leftOperand.value, IDENTIFIER_MAX_LENGTH, [...path, "leftOperand", "value"]);
  if (leftOperand.type === "element" && leftOperand.meta) {
    const metaPath = [...path, "leftOperand", "meta"];
    checkEntriesMax(ctx, leftOperand.meta, QUOTA_OPERAND_META_MAX_ENTRIES, metaPath);
    for (const [key, value] of Object.entries(leftOperand.meta)) {
      checkStringMax(ctx, key, IDENTIFIER_MAX_LENGTH, metaPath);
      checkStringMax(ctx, value, IDENTIFIER_MAX_LENGTH, [...metaPath, key]);
    }
  }

  if (!rightOperand) return;
  const rightPath = [...path, "rightOperand"];
  if (rightOperand.type !== "static") {
    checkStringMax(ctx, rightOperand.value, IDENTIFIER_MAX_LENGTH, [...rightPath, "value"]);
    return;
  }
  if (typeof rightOperand.value === "string") {
    checkStringMax(ctx, rightOperand.value, FILTER_TEXT_MAX_LENGTH, [...rightPath, "value"]);
  } else if (Array.isArray(rightOperand.value)) {
    rightOperand.value.forEach((item, index) =>
      checkStringMax(ctx, item, FILTER_TEXT_MAX_LENGTH, [...rightPath, "value", index])
    );
  }
  if (rightOperand.columnId !== undefined) {
    checkStringMax(ctx, rightOperand.columnId, IDENTIFIER_MAX_LENGTH, [...rightPath, "columnId"]);
  }
  rightOperand.columnIds?.forEach((columnId, index) =>
    checkStringMax(ctx, columnId, IDENTIFIER_MAX_LENGTH, [...rightPath, "columnIds", index])
  );
};

const ZQuotaLogic = z
  .object({ connector: ZSurveyQuotaLogic.shape.connector, conditions: z.array(ZQuotaCondition) })
  .strict()
  .superRefine((logic, ctx) =>
    logic.conditions.forEach((condition, index) => checkQuotaCondition(condition, ["conditions", index], ctx))
  );

/**
 * A quota as the editor's quota modal writes it. Strict, with a bounded name, then held to the shared
 * `ZSurveyQuotaInput` rules (an ending card for `endSurvey`). Arrays are held to the wrapper's request
 * array budget. On an update the `surveyId` is ignored: a quota stays on the survey it was created on
 * (ENG-1749).
 */
export const ZQuotaBody = z
  .object({
    ...ZSurveyQuotaInput.shape,
    name: ZSurveyQuotaInput.shape.name.max(QUOTA_NAME_MAX_LENGTH),
    limit: z.int().min(1, { error: "Limit must be greater than 0" }).max(QUOTA_LIMIT_MAX),
    logic: ZQuotaLogic,
  })
  .strict()
  .pipe(ZSurveyQuotaInput);

export type TQuotaBody = z.infer<typeof ZQuotaBody>;

export const ZQuotaParams = z.object({ quotaId: ZId }).strict();
