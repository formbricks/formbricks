import type { WorkflowsLogger } from "../services/ports";

/** Permission level required for an operation, mirroring the v3 team-permission vocabulary. */
export type WorkflowApiAccess = "read" | "readWrite" | "manage";

/** Resolved internal workspace identity returned by a successful authorization. */
export interface AuthorizedWorkspace {
  workspaceId: string;
  organizationId: string;
}

/**
 * Per-request context the Next.js adapter builds and passes to the framework-agnostic handlers.
 * `authorize` is a capability bound by the adapter to the authenticated request (wrapping
 * `requireV3WorkspaceAccess`): it returns the resolved workspace on success, or a ready-to-return
 * problem `Response` (401/403) on failure — so authorization logic never leaks into this package.
 */
export interface WorkflowApiContext {
  userId: string | null;
  requestId: string;
  instance?: string;
  logger: WorkflowsLogger;
  authorize: (workspaceId: string, access: WorkflowApiAccess) => Promise<AuthorizedWorkspace | Response>;
}
