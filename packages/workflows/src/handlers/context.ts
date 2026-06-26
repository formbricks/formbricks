import type { WorkflowsLogger } from "../services/ports";

/** Permission level required for an operation, mirroring the v3 team-permission vocabulary. */
export type WorkflowApiAccess = "read" | "readWrite" | "manage";

/** Resolved internal workspace identity returned by a successful authorization. */
export interface AuthorizedWorkspace {
  workspaceId: string;
  organizationId: string;
}

/** Result of checking that a trigger's referenced survey + ending cards exist in the workspace. */
export interface TriggerSurveyCheck {
  surveyExists: boolean;
  missingEndingCardIds: string[];
}

/**
 * Audit detail a mutating handler surfaces to the adapter after a successful service call.
 * Deliberately app-agnostic: the affected workflow id, its workspace id, plus before/after
 * snapshots as plain serializable objects. The adapter (apps/web) maps these onto the request's
 * audit log; this package never knows about the audit subsystem. For create/duplicate `targetId`
 * is the new row's id (it only exists after the mutation), `oldObject` is omitted; for delete
 * `newObject` is omitted. The `status` transition is captured in both snapshots so the diff
 * surfaces it.
 *
 * `workspaceId` is first-class (not inferred from the snapshots) so the adapter can resolve the
 * organization deterministically — a snapshot reshape or a redacted field can never silently
 * regress org resolution. The handler always knows the authorized workspace id.
 */
export interface WorkflowAuditDetail {
  targetId: string;
  workspaceId: string;
  oldObject?: Record<string, unknown>;
  newObject?: Record<string, unknown>;
}

/**
 * Per-request context the Next.js adapter builds and passes to the framework-agnostic handlers.
 *
 * `authorize` is a capability bound by the adapter to the authenticated request (wrapping
 * `requireV3WorkspaceAccess`): it returns the resolved workspace on success, or a ready-to-return
 * problem `Response` (401/403) on failure — so authorization logic never leaks into this package.
 *
 * `verifyTriggerSurvey` is an injected lookup (the adapter queries the Survey table) so the package
 * stays survey-agnostic; enable uses it to confirm the trigger's survey + ending cards still exist.
 * It is intentionally specific to the `response.completed` trigger (the only kind today); once other
 * trigger types need reference validation, this generalizes to a per-trigger validator keyed on
 * `trigger.type` rather than growing a `verifyXxx` capability per trigger.
 *
 * `recordAudit` is an optional injected sink the mutating handlers `await` once, after a successful
 * service call, to surface the affected workflow id + before/after snapshots. The adapter binds it
 * to the request's audit log (Enterprise audit-log subsystem) and may do async work (e.g. resolving
 * the organization from the workspace); when no adapter wires it (or audit logging is off) the call
 * is simply a no-op. Keeping it a narrow port preserves the package's framework-agnosticism — it
 * never imports the app's audit module. The adapter must never let an audit failure throw, since
 * these calls run on the success path of an already-completed mutation.
 *
 * `auditRedactionKey` is the secret the adapter injects (the app's audit/encryption secret) so the
 * package can HMAC PII markers in audit snapshots instead of a plain hash — a plain `sha256` of a
 * low-entropy value like an email is offline-guessable from audit-log read access. Injected as data
 * (never read from env here) to keep the package framework-agnostic; when absent the redactor falls
 * back to an unkeyed digest so non-EE/local still works.
 */
export interface WorkflowApiContext {
  userId: string | null;
  requestId: string;
  instance?: string;
  logger: WorkflowsLogger;
  auditRedactionKey?: string;
  authorize: (workspaceId: string, access: WorkflowApiAccess) => Promise<AuthorizedWorkspace | Response>;
  verifyTriggerSurvey: (input: {
    workspaceId: string;
    surveyId: string;
    endingCardIds: string[];
  }) => Promise<TriggerSurveyCheck>;
  recordAudit?: (detail: WorkflowAuditDetail) => void | Promise<void>;
}
