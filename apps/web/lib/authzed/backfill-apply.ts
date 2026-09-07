import "server-only";
import { reconcileApiKeyRelationships } from "./api-key";
import type { TAuthzedBackfillApply } from "./backfill";
import {
  deleteFeedbackDirectoryAssignmentRelationships,
  reconcileFeedbackDirectoryRelationships,
} from "./feedback-directory";
import { reconcileOrganizationMemberships } from "./organization-membership";
import { reconcileTeamWorkspaceRelationships } from "./team-workspace";

const INERT_RESULT = { passes: 0, status: "projected" } as const;

/** No-op write capability used when the shared orchestrator runs in dry-run mode. */
export const createAuthzedBackfillNoopApply = (): TAuthzedBackfillApply => ({
  deleteFeedbackDirectoryAssignmentResources: async () => INERT_RESULT,
  reconcileApiKeys: async () => INERT_RESULT,
  reconcileFeedbackDirectories: async () => INERT_RESULT,
  reconcileMemberships: async () => INERT_RESULT,
  reconcileTeamWorkspace: async () => INERT_RESULT,
});

/** Internal write capability shared by the operator CLI and the scheduled attributable repair. */
export const createAuthzedBackfillApply = (): TAuthzedBackfillApply => ({
  deleteFeedbackDirectoryAssignmentResources: deleteFeedbackDirectoryAssignmentRelationships,
  reconcileApiKeys: reconcileApiKeyRelationships,
  reconcileFeedbackDirectories: reconcileFeedbackDirectoryRelationships,
  reconcileMemberships: reconcileOrganizationMemberships,
  reconcileTeamWorkspace: reconcileTeamWorkspaceRelationships,
});
