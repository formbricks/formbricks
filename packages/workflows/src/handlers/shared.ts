import { WorkflowForbiddenError, WorkflowInvalidInputError, WorkflowInvalidStateError } from "../errors";
import type { WorkflowRow, WorkflowRowWithLastRun } from "../services/ports";
import type { WorkflowsService } from "../services/workflows.service";
import { redactWorkflowDefinitionPII } from "./audit-redaction";
import type { WorkflowApiAccess, WorkflowApiContext } from "./context";
import { toWorkflowResource } from "./serializers";

/**
 * Helpers every handler module shares: body reading, load-and-authorize, and the audit sink. Kept
 * apart from `workflows.handlers.ts` so operation families in their own files (the webhook
 * operations, ENG-7177) use the same ones without importing that module.
 */

// Matches the v3 API's default request-body limit (apps/web `request-body.ts`) for consistency.
const MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024;

export const readJsonBody = async (req: Request, options?: { allowEmpty?: boolean }): Promise<unknown> => {
  // Reject oversized payloads up front via Content-Length so we never buffer them into memory.
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_REQUEST_BODY_BYTES) {
    throw new WorkflowInvalidInputError("Request body is too large.");
  }

  const text = await req.text();
  // Defense in depth: Content-Length may be absent (chunked) or understated.
  if (Buffer.byteLength(text, "utf8") > MAX_REQUEST_BODY_BYTES) {
    throw new WorkflowInvalidInputError("Request body is too large.");
  }

  // Optional-body operations (e.g. duplicate) treat an empty body as `{}`.
  if (text.trim() === "") {
    if (options?.allowEmpty) return {};
    throw new WorkflowInvalidInputError("Malformed JSON body.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new WorkflowInvalidInputError("Malformed JSON body.");
  }
};

/**
 * Load a workflow by id and authorize the caller against its workspace. Returns the row on success,
 * or a ready-to-return denial `Response`; throws `WorkflowForbiddenError` (→ 403) for unknown ids so
 * existence is never leaked. Shared by every by-id operation (get, patch, duplicate, delete,
 * archive, unarchive) — load once, authorize once, no double round-trip.
 */
export const loadAndAuthorize = async (
  service: WorkflowsService,
  ctx: WorkflowApiContext,
  workflowId: string,
  access: WorkflowApiAccess
): Promise<WorkflowRowWithLastRun | Response> => {
  const row = await service.getWorkflowById(workflowId);
  if (!row) throw new WorkflowForbiddenError();

  const authorized = await ctx.authorize(row.workspaceId, access);
  if (authorized instanceof Response) return authorized;

  return row;
};

/** Archived workflows are read-only: every write refuses them with 422 until they are unarchived. */
export const assertNotArchived = (row: Pick<WorkflowRow, "status">): void => {
  if (row.status === "archived") {
    throw new WorkflowInvalidStateError("Archived workflows are read-only; unarchive before editing.");
  }
};

/**
 * Plain before/after snapshot for the audit sink. Reuses the serialized resource shape (the same
 * plain object the response carries), so the adapter's diff surfaces `name` / `description` /
 * `definition` and the `status` transition. Returned as a `Record` because the audit port's
 * snapshots are intentionally untyped, app-agnostic plain objects.
 *
 * The definition's `send_email` PII (recipient/sender addresses, subject, body) is redacted here —
 * the shared audit redactor keys off field names it does not recognize on the workflow definition,
 * so masking at this seam guarantees those values never reach the audit `changes`.
 */
export const toAuditSnapshot = (
  row: WorkflowRowWithLastRun,
  redactionKey?: string
): Record<string, unknown> => {
  const resource = toWorkflowResource(row);
  return { ...resource, definition: redactWorkflowDefinitionPII(resource.definition, redactionKey) };
};

/**
 * Invoke the injected audit sink, swallowing any rejection. The handlers call this only AFTER the
 * mutation has already succeeded, so an audit problem must never turn a successful mutation into an
 * error response — the package guarantees this regardless of how the adapter implements the port.
 */
export const recordAuditSafely = async (
  ctx: WorkflowApiContext,
  detail: Parameters<NonNullable<WorkflowApiContext["recordAudit"]>>[0]
): Promise<void> => {
  try {
    await ctx.recordAudit?.(detail);
  } catch (error) {
    ctx.logger.error({ error }, "Failed to record workflow audit detail");
  }
};
