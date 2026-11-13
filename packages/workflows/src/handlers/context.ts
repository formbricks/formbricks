import type { WorkflowDefinitionOptions, WorkflowDefinitionSummary } from "../analytics/definition-summary";
import type { WorkflowsLogger } from "../services/ports";
import type { TWorkflowStatus } from "../types/common";

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
  /**
   * The survey exists but is restricted (or has a visibility change pending), so a workflow may not send
   * its responses anywhere (ENG-3283). Absent means visible, for adapters that have no such concept.
   */
  surveyNotWorkspaceVisible?: boolean;
}

/** Result of checking a survey a `send_email` step links to. */
export interface SurveyLinkSurveyCheck {
  surveyId: string;
  status: "ok" | "not_found" | "not_link";
  /** Keys the survey's link takes as Embedded Data (its passed-in fields); empty unless `ok`. */
  acceptedEmbeddedDataKeys: string[];
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

/** The lifecycle operations the analytics sink is told about. `patch` is deliberately absent. */
export type WorkflowAnalyticsOperation =
  | "created"
  | "duplicated"
  | "enabled"
  | "disabled"
  | "archived"
  | "unarchived"
  | "deleted"
  | "tested";

/**
 * Product-analytics detail a handler surfaces to the adapter after a successful operation
 * (ENG-2851). Like `WorkflowAuditDetail` it is app-agnostic, but unlike it the detail is built
 * from PII-free facts only: ids, the status transition, timestamps and the definition's *shape*
 * (trigger type, step types, counts, option flags). The definition itself never crosses this seam,
 * so an adapter cannot forward an email body or recipient to an analytics vendor by accident.
 *
 * `patch` has no operation on purpose: the builder autosaves every couple of seconds, so a
 * per-save event would measure typing cadence, not intent. The final shape is reported on
 * `enabled`; the client reports the individual editing steps.
 */
export interface WorkflowAnalyticsDetail {
  operation: WorkflowAnalyticsOperation;
  workflowId: string;
  workspaceId: string;
  /** Lifecycle status after the operation; for `deleted` and `tested`, the status the row had. */
  status: TWorkflowStatus;
  /** Status before the operation, where the operation changed it. */
  previousStatus?: TWorkflowStatus;
  createdAt: Date;
  definition: WorkflowDefinitionSummary;
  options: WorkflowDefinitionOptions;
  /** `duplicated` only: the workflow the copy was made from. */
  sourceWorkflowId?: string;
  /** `tested` only: whether the dry run reported zero problems. */
  testOk?: boolean;
}

/**
 * Stores secret header values (ENG-7168, ADR 0043). Injected by the adapter, which owns the
 * encryption key, so this package never handles key material. Every call is scoped to one workflow:
 * `replace` and the deletes must never reach another workflow's rows.
 */
export interface WorkflowSecretStore {
  /** Encrypts and stores a new value for the workflow; returns the new row's id. */
  create: (input: { workflowId: string; workspaceId: string; value: string }) => Promise<{ id: string }>;
  /** Overwrites a stored value in place, so every version that references it uses the new value. */
  replace: (input: {
    secretId: string;
    workflowId: string;
    workspaceId: string;
    value: string;
  }) => Promise<void>;
  /**
   * Deletes the workflow's secrets that neither `referencedSecretIds` (the draft being enabled) nor
   * any of the workflow's versions reference. The adapter reads the versions.
   */
  deleteUnreferenced: (input: {
    workflowId: string;
    workspaceId: string;
    referencedSecretIds: string[];
  }) => Promise<void>;
}

/** One secret header a write stored: the header name only, never its value. */
export interface TWorkflowSecretHeaderChange {
  stepId: string;
  headerName: string;
  change: "set" | "replaced";
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
 * `recordAnalytics` is the product-analytics twin of `recordAudit`: same optional-sink shape, same
 * call discipline (once, after success, never allowed to fail the request), bound by the adapter to
 * its analytics client. It exists as a separate port rather than a flag on the audit sink because
 * the two have different consumers and different data rules; see `WorkflowAnalyticsDetail`.
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
  /**
   * Origin the Webhook Secret URL is built on (the app's own URL, where `/api/v3` is served). Injected as
   * data like `auditRedactionKey`; the webhook operations answer 500 without it.
   */
  webhookBaseUrl?: string;
  authorize: (workspaceId: string, access: WorkflowApiAccess) => Promise<AuthorizedWorkspace | Response>;
  verifyTriggerSurvey: (input: {
    workspaceId: string;
    surveyId: string;
    endingCardIds: string[];
  }) => Promise<TriggerSurveyCheck>;
  /**
   * Injected recipient allowlist check (the adapter resolves who can access the workspace) so the
   * package stays user/tenancy-agnostic. `send_email` actions may address a literal email; to
   * prevent a workflow from silently forwarding response data to an arbitrary external inbox
   * (ENG-2029), or to someone whose access to the workspace was revoked (ENG-2186), enable/test
   * confirm every literal recipient can still access the workspace. Given the literal recipient
   * emails on a definition, it returns the subset that is NOT allowed.
   *
   * An adapter must scope this to the workspace, not merely to its organization: an organization
   * member with no access to *this* workspace has to come back disallowed, otherwise enable accepts
   * recipients the authoring picker never offers and the runner's send-time backstop then refuses.
   * Compare emails case-insensitively.
   */
  verifyRecipientsAllowed: (input: {
    workspaceId: string;
    emails: string[];
  }) => Promise<{ disallowedEmails: string[] }>;
  /**
   * Injected survey visibility check (ENG-3282) so the package stays survey-agnostic: of the surveys in
   * this workspace (or of `surveyIds`, when given), the ids the caller may not read. A run of a
   * survey-triggered workflow carries that survey's response data (`triggerPayload`, `data`, step
   * logs), so the run history follows the survey: runs of these surveys are left out of the list and
   * refused by id. One call per request, never per run; `[]` when nothing is hidden (visibility not
   * enforced, an organization administrator, or no restricted survey).
   */
  listUnreadableSurveyIds: (input: {
    workspaceId: string;
    organizationId: string;
    surveyIds?: string[];
  }) => Promise<string[]>;
  /**
   * Injected lookup of the surveys `send_email` steps link to (ENG-7180), so the package stays
   * survey-agnostic. One entry per requested id: `not_found` when the survey is not in this workspace,
   * `not_link` when it is not a link survey, and the Embedded Data keys its link accepts (its
   * passed-in fields) so enable and test can warn about keys the survey would drop.
   */
  verifySurveyLinkSurveys: (input: {
    workspaceId: string;
    surveyIds: string[];
  }) => Promise<SurveyLinkSurveyCheck[]>;
  recordAudit?: (detail: WorkflowAuditDetail) => void | Promise<void>;
  /**
   * Where secret header values are stored. Required by any write that carries a secret value; a
   * write that would otherwise have to persist one in the definition is refused instead.
   */
  secrets?: WorkflowSecretStore;
  /**
   * Audit sink for secret headers set or replaced by a write ("secret set" / "secret replaced"), with
   * the header name only. Called once per write that changed any, after it succeeded.
   */
  recordSecretHeaderChanges?: (detail: {
    workflowId: string;
    workspaceId: string;
    changes: TWorkflowSecretHeaderChange[];
  }) => void | Promise<void>;
  recordAnalytics?: (detail: WorkflowAnalyticsDetail) => void | Promise<void>;
}
