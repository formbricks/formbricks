import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZSurveyBase, ZSurveyType } from "@formbricks/types/surveys/types";

type TLenientSurveyShape = { [K in keyof typeof ZSurveyBase.shape]: z.ZodOptional<z.ZodUnknown> };

/**
 * Every key a survey has, accepted unchecked: a draft may be incomplete, and `ZSurvey` checks it in full
 * when it is published. Built from `ZSurveyBase` so a field added to surveys reaches the draft save too.
 */
const lenientSurveyShape = Object.fromEntries(
  Object.keys(ZSurveyBase.shape).map((key) => [key, z.unknown().optional()])
) as TLenientSurveyShape;

/**
 * Lenient schema for draft survey updates.
 * Validates essential fields for security/functionality but allows incomplete survey data.
 * Full validation (ZSurvey) is enforced when publishing.
 *
 * ENG-7127: a plain object, so a key a survey does not have is stripped here. A loose object kept them,
 * and they reached Prisma as relation writes (`responses`, `workspace`, `creator`, …) or foreign keys
 * (`segmentId`). `updateSurveyInternal` also writes allow-listed columns only; this stops them earlier.
 */
export const ZSurveyDraft = z.object({
  ...lenientSurveyShape,

  // Essential fields - strictly validated
  id: ZId,
  status: z.literal("draft"),
  type: ZSurveyType,
  name: z.string().min(1, "Survey name is required"),

  // Required fields for database operations - loosely validated
  blocks: z.array(z.record(z.string(), z.unknown())).optional(),
  triggers: z.array(z.record(z.string(), z.unknown())).optional(),
  endings: z.array(z.record(z.string(), z.unknown())).optional(),
  segment: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type TSurveyDraft = z.infer<typeof ZSurveyDraft>;
