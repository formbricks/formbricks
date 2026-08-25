/**
 * Survey Follow-ups are deprecated in favour of Workflows, which cover the same
 * `response completed → send email` automation through a workspace-level surface
 * (`packages/workflows` documents the 1:1 field parity of the two send-email configs).
 *
 * Nothing is removed yet: this module only decides who still gets shown the editor tab, so the
 * migration debt stops growing while everyone who relies on the feature keeps it.
 */

/** Announced removal date, ISO-8601 so the stored value stays non-localized. */
export const SURVEY_FOLLOW_UPS_SUNSET_DATE = new Date("2026-12-01T00:00:00.000Z");

/** Docs page that explains the replacement. */
export const WORKFLOWS_DOCS_URL = "https://formbricks.com/docs/workflows/overview";

interface FollowUpsTabVisibilityInput {
  /** Follow-ups persisted on the survey — deliberately the server count, see below. */
  followUpCount: number;
  isSurveyFollowUpsAllowed: boolean;
  isWorkflowsAllowed: boolean;
}

/**
 * Whether the survey editor still offers the Follow-ups tab.
 *
 * A survey that already has follow-ups always keeps the tab: they are live automation and their
 * owner has to be able to read, fix and eventually migrate them. That holds even when the
 * entitlement has since lapsed (a Cloud trial or a downgrade), because hiding the tab there would
 * hide automation the survey still carries.
 *
 * With no follow-ups yet, the tab survives only where Workflows cannot replace it — self-hosted
 * without an enterprise license being the case that matters, since follow-ups are free there
 * (`getSurveyFollowUpsPermission`) while Workflows are licensed. Taking the feature away from that
 * deployment would leave it with no path forward at all, so it keeps the tab until the packaging
 * question is settled.
 *
 * Everyone else — Workflows available, or follow-ups not entitled anyway — no longer sees it. That
 * is what stops new follow-ups being created, and it retires the upsell that used to sell a
 * deprecated feature to organizations that never had it.
 *
 * Callers pass the *persisted* count rather than the editor's working copy on purpose: the working
 * copy soft-deletes with a `deleted` flag, so counting it would pull the tab out from under someone
 * who just deleted their last follow-up and has not saved yet.
 */
export const shouldShowFollowUpsTab = ({
  followUpCount,
  isSurveyFollowUpsAllowed,
  isWorkflowsAllowed,
}: FollowUpsTabVisibilityInput): boolean => {
  if (followUpCount > 0) {
    return true;
  }

  return isSurveyFollowUpsAllowed && !isWorkflowsAllowed;
};
