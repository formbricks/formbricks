import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZLinkedEmbeddedField } from "@formbricks/types/embedded-data";
import { ZSurveyBase, ZSurveyStyling, ZSurveyType } from "@formbricks/types/surveys/types";

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

  // Structural, so it is validated here rather than waiting for publish (ENG-2628). The draft path
  // skips `ZSurvey` but not the write: `updateSurveyInternal` runs `linkedToDesiredEmbeddedFields`
  // over this key regardless of `skipValidation`, so anything that is not a row list reaches the
  // mapper and throws there — a 500 where the request deserves a 400. A malformed-but-mappable entry
  // is worse still: it writes, and the survey then fails `ZSurvey` forever and cannot be published.
  embeddedFields: z.array(ZLinkedEmbeddedField).optional(),

  // Its free-text values are written into the survey's CSS, so a draft save checks them like a
  // publish does: a value that is not valid for its property cannot add declarations (ENG-2950).
  styling: ZSurveyStyling.nullish(),
});

export type TSurveyDraft = z.infer<typeof ZSurveyDraft>;
