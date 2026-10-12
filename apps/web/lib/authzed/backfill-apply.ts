import "server-only";
import { reconcileApiKeyRelationships } from "./api-key";
import type { TAuthzedBackfillApply } from "./backfill";
import {
  deleteFeedbackDirectoryAssignmentRelationships,
  reconcileFeedbackDirectoryRelationships,
} from "./feedback-directory";
import { reconcileOrganizationMemberships } from "./organization-membership";
import { reconcileSurveyRelationships } from "./survey";
import { reconcileTeamWorkspaceRelationships } from "./team-workspace";

const INERT_RESULT = { passes: 0, status: "projected" } as const;
const inert = () => Promise.resolve(INERT_RESULT);

/** No-op write capability used when the shared orchestrator runs in dry-run mode. */
export const createAuthzedBackfillNoopApply = (): TAuthzedBackfillApply => ({
  deleteFeedbackDirectoryAssignmentResources: inert,
  reconcileApiKeys: inert,
  reconcileFeedbackDirectories: inert,
  reconcileMemberships: inert,
  reconcileSurveys: inert,
  reconcileTeamWorkspace: inert,
});

/** Internal write capability shared by the operator CLI and the scheduled attributable repair. */
export const createAuthzedBackfillApply = (): TAuthzedBackfillApply => ({
  deleteFeedbackDirectoryAssignmentResources: deleteFeedbackDirectoryAssignmentRelationships,
  reconcileApiKeys: reconcileApiKeyRelationships,
  reconcileFeedbackDirectories: reconcileFeedbackDirectoryRelationships,
  reconcileMemberships: reconcileOrganizationMemberships,
  reconcileSurveys: reconcileSurveyRelationships,
  reconcileTeamWorkspace: reconcileTeamWorkspaceRelationships,
});
