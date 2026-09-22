import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZLinkedEmbeddedField } from "@formbricks/types/embedded-data";
import { ZSurveyType } from "@formbricks/types/surveys/types";

/**
 * Lenient schema for draft survey updates.
 * Validates essential fields for security/functionality but allows incomplete survey data.
 * Full validation (ZSurvey) is enforced when publishing.
 */
export const ZSurveyDraft = z.looseObject({
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
}); // Allow all other fields without validation

export type TSurveyDraft = z.infer<typeof ZSurveyDraft>;
