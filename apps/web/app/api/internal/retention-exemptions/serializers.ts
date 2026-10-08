import type { TRetentionExemptionRow } from "@/modules/ee/data-retention/lib/exemptions-service";
import type { TRetentionExemption } from "@/modules/ee/data-retention/types";

/** An exemption as the API returns it (ENG-3695): `policy` is the policy it holds the survey from. */
export const serializeRetentionExemption = (row: TRetentionExemptionRow): TRetentionExemption => ({
  id: row.id,
  surveyId: row.surveyId,
  surveyName: row.surveyName,
  workspaceId: row.workspaceId,
  policy: row.entity,
  until: row.until.toISOString(),
  reason: row.reason,
  // The creator is cleared when their account is deleted, which leaves the exemption in place.
  createdBy: row.createdById ? { id: row.createdById, name: row.createdByName ?? "" } : null,
  createdAt: row.createdAt.toISOString(),
  revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
});
