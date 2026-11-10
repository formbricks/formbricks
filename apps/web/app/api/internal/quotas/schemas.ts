import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZSurveyQuotaInput, ZSurveyQuotaLogic } from "@formbricks/types/quota";
import { ZSingleCondition } from "@formbricks/types/surveys/logic";

/** Longest quota name a write may set: far above any name the editor's field shows in full. */
export const QUOTA_NAME_MAX_LENGTH = 255;

/** The keys a quota condition has (`ZSingleCondition`). */
const QUOTA_CONDITION_KEYS = new Set(["id", "leftOperand", "operator", "rightOperand", "connector"]);

/**
 * A quota condition, refusing keys it doesn't have. `ZSingleCondition` is an intersection with records in
 * its operands, which `strictDeep` cannot rebuild, so the unknown-key check runs on the condition itself;
 * the operands below it keep the shared schema's rules.
 */
const ZQuotaCondition = z.preprocess((value, ctx) => {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const unknownKeys = Object.keys(value).filter((key) => !QUOTA_CONDITION_KEYS.has(key));
    if (unknownKeys.length > 0) ctx.addIssue({ code: "unrecognized_keys", keys: unknownKeys, input: value });
  }
  return value;
}, ZSingleCondition);

const ZQuotaLogic = ZSurveyQuotaLogic.safeExtend({ conditions: z.array(ZQuotaCondition) }).strict();

/**
 * A quota as the editor's quota modal writes it, with the shared rules (an ending card for `endSurvey`).
 * Arrays are held to the wrapper's request array budget. On an update the `surveyId` is ignored: a quota
 * stays on the survey it was created on (ENG-1749).
 */
export const ZQuotaBody = ZSurveyQuotaInput.safeExtend({
  name: z.string().min(1, { error: "Quota name is required" }).max(QUOTA_NAME_MAX_LENGTH),
  logic: ZQuotaLogic,
}).strict();

export type TQuotaBody = z.infer<typeof ZQuotaBody>;

export const ZQuotaParams = z.object({ quotaId: ZId }).strict();
