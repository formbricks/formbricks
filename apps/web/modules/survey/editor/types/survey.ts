import { z } from "zod";
import { ZId } from "@formbricks/types/common";
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
  environmentId: ZId,
  type: ZSurveyType,
  name: z.string().min(1, "Survey name is required"),

  // Required fields for database operations - loosely validated
  blocks: z.array(z.record(z.string(), z.unknown())).optional(),
  triggers: z.array(z.record(z.string(), z.unknown())).optional(),
  endings: z.array(z.record(z.string(), z.unknown())).optional(),
  segment: z.record(z.string(), z.unknown()).nullable().optional(),
}); // Allow all other fields without validation

export type TSurveyDraft = z.infer<typeof ZSurveyDraft>;
