import { z } from "zod";
import { RETENTION_SURVEY_CONDITIONS } from "@/modules/ee/data-retention/types";

export const ZRetentionPoliciesQuery = z.object({ organizationId: z.cuid2() }).strict();

export type TRetentionPoliciesQuery = z.infer<typeof ZRetentionPoliciesQuery>;

// Shapes only: whether a value is in range is a business rule (422), checked on the merged policy by
// `getRetentionPolicyIssues`.
const ZDays = z.number().int();

const ZPolicyFieldsPatch = z
  .object({
    enabled: z.boolean(),
    warnDays: ZDays,
    periodDays: ZDays,
  })
  .partial()
  .strict();

const ZSurveysPolicyPatch = ZPolicyFieldsPatch.extend({
  conditions: z.array(z.enum(RETENTION_SURVEY_CONDITIONS)).max(RETENTION_SURVEY_CONDITIONS.length),
})
  .partial()
  .strict();

/**
 * `PATCH /api/internal/retention-policies` body: a strict top-level partial of the policies document
 * that names exactly one policy (the UI edits one dialog at a time), with at least one of its fields.
 * One policy per request also means one audit event per policy.
 */
export const ZRetentionPoliciesPatchBody = z
  .object({
    responses: ZPolicyFieldsPatch,
    surveys: ZSurveysPolicyPatch,
    members: ZPolicyFieldsPatch,
  })
  .partial()
  .strict()
  .superRefine((body, ctx) => {
    const entries = Object.entries(body);
    if (entries.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: [],
        message: "Send exactly one policy: responses, surveys or members.",
      });
      return;
    }
    const [policy, fields] = entries[0];
    if (Object.keys(fields).length === 0) {
      ctx.addIssue({ code: "custom", path: [policy], message: "Send at least one field to change." });
    }
  });

export type TRetentionPoliciesPatchBody = z.infer<typeof ZRetentionPoliciesPatchBody>;
