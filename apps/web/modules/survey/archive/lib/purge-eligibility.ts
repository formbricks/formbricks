import type { Prisma } from "@formbricks/database/prisma";

/**
 * The surveys the archive purge may delete at `cutoff` (now minus the retention window): archived before
 * it, and not held by a retention exemption that lasted past it, on either policy. An exemption's end is
 * `LEAST(until, revokedAt)`, so a survey whose hold ended or was revoked gets the full window again from
 * then, and ending an exemption never deletes on the same night (ENG-3614). A held survey stays out of
 * the purge's batches entirely, so held surveys can't crowd out the rest.
 *
 * One predicate for the purge's candidate query, its pre-check and its locked re-check, so they can't
 * disagree. Exemptions are honoured whether or not the organisation still has the licence: a hold is
 * never the wrong side to err on.
 */
export const getSurveyPurgeEligibleWhere = (cutoff: Date): Prisma.SurveyWhereInput => ({
  archivedAt: { lt: cutoff },
  retentionExemptions: {
    none: { until: { gt: cutoff }, OR: [{ revokedAt: null }, { revokedAt: { gt: cutoff } }] },
  },
});
