import {
  summarizeWorkflowDefinition,
  summarizeWorkflowDefinitionOptions,
} from "../analytics/definition-summary";
import {
  type TWorkflowIdInput,
  type TWorkflowRunIdInput,
  type TWorkflowTestProblem,
  ZCreateWorkflowInput,
  ZDuplicateWorkflowInput,
  ZPatchWorkflowInput,
  ZWorkflowListItem,
  ZWorkflowResource,
  ZWorkflowRunListItem,
  ZWorkflowRunResource,
  ZWorkflowTestResult,
  zCursorPage,
} from "../contracts";
import {
  WorkflowForbiddenError,
  WorkflowInvalidInputError,
  type WorkflowInvalidParam,
  WorkflowInvalidStateError,
  WorkflowNotExecutableError,
  toProblemResponse,
  validateOutput,
} from "../errors";
import { isLiteralEmailRecipient } from "../recipients";
import { createdResponse, dataResponse, listResponse, noContentResponse } from "../responses";
import type { WorkflowRowWithLastRun } from "../services/ports";
import type { WorkflowsService } from "../services/workflows.service";
import { type TWorkflowExecutableDefinition, ZWorkflowExecutableDefinition } from "../types/document";
import { redactWorkflowDefinitionPII } from "./audit-redaction";
import type {
  TriggerSurveyCheck,
  WorkflowAnalyticsDetail,
  WorkflowAnalyticsOperation,
  WorkflowApiAccess,
  WorkflowApiContext,
} from "./context";
import { parseListWorkflowRunsQuery, parseListWorkflowsQuery } from "./parse-list-query";
import {
  toWorkflowListItem,
  toWorkflowResource,
  toWorkflowRunListItem,
  toWorkflowRunResource,
} from "./serializers";

// Matches the v3 API's default request-body limit (apps/web `request-body.ts`) for consistency.
const MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024;

const ZWorkflowListPage = zCursorPage(ZWorkflowListItem);
const ZWorkflowRunListPage = zCursorPage(ZWorkflowRunListItem);

const readJsonBody = async (req: Request, options?: { allowEmpty?: boolean }): Promise<unknown> => {
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
const loadAndAuthorize = async (
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
const toAuditSnapshot = (row: WorkflowRowWithLastRun, redactionKey?: string): Record<string, unknown> => {
  const resource = toWorkflowResource(row);
  return { ...resource, definition: redactWorkflowDefinitionPII(resource.definition, redactionKey) };
};

/**
 * Invoke the injected audit sink, swallowing any rejection. The handlers call this only AFTER the
 * mutation has already succeeded, so an audit problem must never turn a successful mutation into an
 * error response — the package guarantees this regardless of how the adapter implements the port.
 */
const recordAuditSafely = async (
  ctx: WorkflowApiContext,
  detail: Parameters<NonNullable<WorkflowApiContext["recordAudit"]>>[0]
): Promise<void> => {
  try {
    await ctx.recordAudit?.(detail);
  } catch (error) {
    ctx.logger.error({ error }, "Failed to record workflow audit detail");
  }
};

/** Same contract as `recordAuditSafely`, for the product-analytics sink. */
const recordAnalyticsSafely = async (
  ctx: WorkflowApiContext,
  detail: WorkflowAnalyticsDetail
): Promise<void> => {
  try {
    await ctx.recordAnalytics?.(detail);
  } catch (error) {
    ctx.logger.error({ error }, "Failed to record workflow analytics detail");
  }
};

/**
 * Analytics detail for a completed operation. Only shape summaries of the definition leave this
 * seam (see `WorkflowAnalyticsDetail`); the row's `definition` is read here and nowhere downstream.
 */
const toAnalyticsDetail = (
  operation: WorkflowAnalyticsOperation,
  row: WorkflowRowWithLastRun,
  extra: Pick<WorkflowAnalyticsDetail, "previousStatus" | "sourceWorkflowId" | "testOk"> = {}
): WorkflowAnalyticsDetail => ({
  operation,
  workflowId: row.id,
  workspaceId: row.workspaceId,
  status: row.status,
  createdAt: row.createdAt,
  definition: summarizeWorkflowDefinition(row.definition),
  options: summarizeWorkflowDefinitionOptions(row.definition),
  ...extra,
});

/**
 * The literal email recipients configured on a definition's `send_email` actions. A `to` that is
 * itself a valid email is a literal recipient and must be allowlisted (ENG-2029); a `to` that is a
 * survey element id resolves to the respondent's own address at send time and is always allowed, so
 * it is excluded here. Deduplicated so the same address is checked once.
 */
const collectLiteralRecipientEmails = (definition: TWorkflowExecutableDefinition): string[] => {
  const emails = new Set<string>();
  for (const node of definition.nodes) {
    // `send_email` is the only action type today, so `type === "action"` already narrows to its
    // config (which carries `to`); revisit this guard if another action type is added.
    if (node.type === "action") {
      const { to } = node.config;
      if (isLiteralEmailRecipient(to)) {
        emails.add(to);
      }
    }
  }
  return [...emails];
};

/** Dotted path the recipient-allowlist failure is reported against, by both `enable` and `testWorkflow`. */
const DISALLOWED_RECIPIENT_FIELD = "definition.nodes.config.to";

/** Short 422 `detail` for a recipient-allowlist failure, so UI surfacing only `detail` still names the cause. */
const DISALLOWED_RECIPIENT_DETAIL = "A send_email recipient cannot access this workspace.";

/** Per-recipient explanation, shared so enable's `invalid_params` and test's `problems` never diverge. */
const disallowedRecipientMessage = (email: string): string =>
  `Recipient ${email} cannot access this workspace. A send_email action may only address someone with access to this workspace or a respondent field.`;

const buildDisallowedRecipientParams = (disallowedEmails: string[]): WorkflowInvalidParam[] =>
  disallowedEmails.map((email) => ({
    name: DISALLOWED_RECIPIENT_FIELD,
    reason: disallowedRecipientMessage(email),
  }));

/** Map a failed trigger-survey check to field-level `invalid_params` on the definition's trigger config. */
const buildSurveyInvalidParams = (check: TriggerSurveyCheck): WorkflowInvalidParam[] => {
  const invalidParams: WorkflowInvalidParam[] = [];
  if (!check.surveyExists) {
    invalidParams.push({
      name: "definition.trigger.config.surveyId",
      reason: "The referenced survey does not exist in this workspace.",
    });
  }
  for (const endingCardId of check.missingEndingCardIds) {
    invalidParams.push({
      name: "definition.trigger.config.endingCardIds",
      reason: `Ending card ${endingCardId} does not exist on the survey.`,
    });
  }
  return invalidParams;
};

/**
 * Handler argument shapes. Every handler takes a single object (never positional args) so call
 * sites are uniform and self-documenting — mirroring the v3 API's single-object handler convention
 * (e.g. `listV3Surveys({ searchParams, authentication, ... })`). Each shape carries only the fields
 * its handler uses, so there are no unused parameters to thread through.
 */
interface WorkflowRequestArgs {
  req: Request;
  ctx: WorkflowApiContext;
}
interface WorkflowResourceArgs {
  ctx: WorkflowApiContext;
  params: TWorkflowIdInput;
}
interface WorkflowResourceBodyArgs extends WorkflowResourceArgs {
  req: Request;
}
interface WorkflowRunResourceArgs {
  ctx: WorkflowApiContext;
  params: TWorkflowRunIdInput;
}

export interface WorkflowsHandlers {
  list: (args: WorkflowRequestArgs) => Promise<Response>;
  create: (args: WorkflowRequestArgs) => Promise<Response>;
  get: (args: WorkflowResourceArgs) => Promise<Response>;
  patch: (args: WorkflowResourceBodyArgs) => Promise<Response>;
  duplicate: (args: WorkflowResourceBodyArgs) => Promise<Response>;
  delete: (args: WorkflowResourceArgs) => Promise<Response>;
  archive: (args: WorkflowResourceArgs) => Promise<Response>;
  unarchive: (args: WorkflowResourceArgs) => Promise<Response>;
  enable: (args: WorkflowResourceArgs) => Promise<Response>;
  disable: (args: WorkflowResourceArgs) => Promise<Response>;
  testWorkflow: (args: WorkflowResourceArgs) => Promise<Response>;
  listRuns: (args: WorkflowRequestArgs) => Promise<Response>;
  getRun: (args: WorkflowRunResourceArgs) => Promise<Response>;
}

/**
 * Web-standard, framework-agnostic handlers for the v3 Workflows CRUD surface. Each handler:
 * parse/validate input with the contract schemas → authorize via the injected `ctx.authorize`
 * capability → call the service → serialize → validate the serialized output against the resource
 * schema → return the success envelope. Any thrown error is mapped (and logged) by
 * `toProblemResponse`, so handlers never leak or swallow.
 */
export const createWorkflowsHandlers = (service: WorkflowsService): WorkflowsHandlers => ({
  async list({ req, ctx }) {
    try {
      const input = parseListWorkflowsQuery(new URL(req.url).searchParams);

      const authorized = await ctx.authorize(input.workspaceId, "read");
      if (authorized instanceof Response) return authorized;

      const workflowPage = await service.listWorkflows({ ...input, workspaceId: authorized.workspaceId });

      const page = validateOutput(ZWorkflowListPage, {
        data: workflowPage.workflows.map(toWorkflowListItem),
        meta: { limit: input.limit, nextCursor: workflowPage.nextCursor },
      });

      return listResponse(page.data, page.meta, ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },

  async create({ req, ctx }) {
    try {
      const input = ZCreateWorkflowInput.parse(await readJsonBody(req));

      const authorized = await ctx.authorize(input.workspaceId, "readWrite");
      if (authorized instanceof Response) return authorized;

      const created = await service.createWorkflow(
        { ...input, workspaceId: authorized.workspaceId },
        { createdBy: ctx.userId }
      );

      const resource = validateOutput(ZWorkflowResource, toWorkflowResource(created));

      // New id only exists post-mutation; capture it here rather than parsing the Response.
      await recordAuditSafely(ctx, {
        targetId: created.id,
        workspaceId: created.workspaceId,
        newObject: toAuditSnapshot(created, ctx.auditRedactionKey),
      });
      await recordAnalyticsSafely(ctx, toAnalyticsDetail("created", created));

      return createdResponse(resource, `/api/v3/workflows/${resource.id}`, ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },

  async get({ ctx, params }) {
    try {
      const loaded = await loadAndAuthorize(service, ctx, params.workflowId, "read");
      if (loaded instanceof Response) return loaded;

      return dataResponse(validateOutput(ZWorkflowResource, toWorkflowResource(loaded)), ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },

  async patch({ req, ctx, params }) {
    try {
      const loaded = await loadAndAuthorize(service, ctx, params.workflowId, "readWrite");
      if (loaded instanceof Response) return loaded;
      if (loaded.status === "archived") {
        throw new WorkflowInvalidStateError("Archived workflows are read-only; unarchive before editing.");
      }

      const input = ZPatchWorkflowInput.parse(await readJsonBody(req));
      if (input.definition !== undefined && loaded.status === "enabled") {
        throw new WorkflowInvalidStateError(
          "A workflow's definition can only be updated while it is draft or disabled."
        );
      }

      const updated = await service.updateWorkflow(
        { workflowId: params.workflowId, workspaceId: loaded.workspaceId },
        input
      );

      await recordAuditSafely(ctx, {
        targetId: updated.id,
        workspaceId: updated.workspaceId,
        oldObject: toAuditSnapshot(loaded, ctx.auditRedactionKey),
        newObject: toAuditSnapshot(updated, ctx.auditRedactionKey),
      });

      return dataResponse(validateOutput(ZWorkflowResource, toWorkflowResource(updated)), ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },

  async duplicate({ req, ctx, params }) {
    try {
      const loaded = await loadAndAuthorize(service, ctx, params.workflowId, "readWrite");
      if (loaded instanceof Response) return loaded;

      const input = ZDuplicateWorkflowInput.parse(await readJsonBody(req, { allowEmpty: true }));
      const created = await service.duplicateWorkflow(loaded, { name: input.name, createdBy: ctx.userId });

      const resource = validateOutput(ZWorkflowResource, toWorkflowResource(created));

      // Target is the new copy, not the source; its id only exists after the mutation.
      await recordAuditSafely(ctx, {
        targetId: created.id,
        workspaceId: created.workspaceId,
        newObject: toAuditSnapshot(created, ctx.auditRedactionKey),
      });
      await recordAnalyticsSafely(
        ctx,
        toAnalyticsDetail("duplicated", created, { sourceWorkflowId: loaded.id })
      );

      return createdResponse(resource, `/api/v3/workflows/${resource.id}`, ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },

  async delete({ ctx, params }) {
    try {
      const loaded = await loadAndAuthorize(service, ctx, params.workflowId, "readWrite");
      if (loaded instanceof Response) return loaded;

      await service.deleteWorkflow({ workflowId: params.workflowId, workspaceId: loaded.workspaceId });

      await recordAuditSafely(ctx, {
        targetId: loaded.id,
        workspaceId: loaded.workspaceId,
        oldObject: toAuditSnapshot(loaded, ctx.auditRedactionKey),
      });
      await recordAnalyticsSafely(ctx, toAnalyticsDetail("deleted", loaded));

      return noContentResponse(ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },

  async archive({ ctx, params }) {
    try {
      const loaded = await loadAndAuthorize(service, ctx, params.workflowId, "readWrite");
      if (loaded instanceof Response) return loaded;
      if (loaded.status === "archived") {
        throw new WorkflowInvalidStateError("Workflow is already archived.");
      }

      const updated = await service.setStatus(
        { workflowId: params.workflowId, workspaceId: loaded.workspaceId },
        "archived"
      );

      await recordAuditSafely(ctx, {
        targetId: updated.id,
        workspaceId: updated.workspaceId,
        oldObject: toAuditSnapshot(loaded, ctx.auditRedactionKey),
        newObject: toAuditSnapshot(updated, ctx.auditRedactionKey),
      });
      await recordAnalyticsSafely(
        ctx,
        toAnalyticsDetail("archived", updated, { previousStatus: loaded.status })
      );

      return dataResponse(validateOutput(ZWorkflowResource, toWorkflowResource(updated)), ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },

  async unarchive({ ctx, params }) {
    try {
      const loaded = await loadAndAuthorize(service, ctx, params.workflowId, "readWrite");
      if (loaded instanceof Response) return loaded;
      if (loaded.status !== "archived") {
        throw new WorkflowInvalidStateError("Only archived workflows can be unarchived.");
      }

      const updated = await service.setStatus(
        { workflowId: params.workflowId, workspaceId: loaded.workspaceId },
        "draft"
      );

      await recordAuditSafely(ctx, {
        targetId: updated.id,
        workspaceId: updated.workspaceId,
        oldObject: toAuditSnapshot(loaded, ctx.auditRedactionKey),
        newObject: toAuditSnapshot(updated, ctx.auditRedactionKey),
      });
      await recordAnalyticsSafely(
        ctx,
        toAnalyticsDetail("unarchived", updated, { previousStatus: loaded.status })
      );

      return dataResponse(validateOutput(ZWorkflowResource, toWorkflowResource(updated)), ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },

  async enable({ ctx, params }) {
    try {
      const loaded = await loadAndAuthorize(service, ctx, params.workflowId, "readWrite");
      if (loaded instanceof Response) return loaded;
      if (loaded.status !== "draft" && loaded.status !== "disabled") {
        throw new WorkflowInvalidStateError("Only draft or disabled workflows can be enabled.");
      }

      // safeParse (not parse): a non-executable definition is a 422 workflow_not_executable,
      // not the generic 400 a thrown ZodError would map to.
      const executable = ZWorkflowExecutableDefinition.safeParse(loaded.definition);
      if (!executable.success) throw WorkflowNotExecutableError.fromZodError(executable.error);

      const { surveyId, endingCardIds } = executable.data.trigger.config;
      const surveyCheck = await ctx.verifyTriggerSurvey({
        workspaceId: loaded.workspaceId,
        surveyId,
        endingCardIds,
      });
      if (!surveyCheck.surveyExists || surveyCheck.missingEndingCardIds.length > 0) {
        throw new WorkflowNotExecutableError(buildSurveyInvalidParams(surveyCheck));
      }

      // Recipient allowlist: a send_email action addressing a literal email may only target someone
      // who can access this workspace — otherwise enabling the workflow would let it forward response
      // data to an arbitrary external inbox on every completed response (ENG-2029). Respondent-field
      // recipients resolve at send time and are not checked here.
      const literalRecipients = collectLiteralRecipientEmails(executable.data);
      if (literalRecipients.length > 0) {
        const { disallowedEmails } = await ctx.verifyRecipientsAllowed({
          workspaceId: loaded.workspaceId,
          emails: literalRecipients,
        });
        if (disallowedEmails.length > 0) {
          // Pass an explicit `detail`: the editor's error mapper surfaces only `detail` and drops
          // `invalid_params`, so the default "definition is not executable" would hide the one thing
          // the author needs to fix. The per-field reasons stay for API/MCP callers.
          throw new WorkflowNotExecutableError(
            buildDisallowedRecipientParams(disallowedEmails),
            DISALLOWED_RECIPIENT_DETAIL
          );
        }
      }

      const updated = await service.enableWorkflow(
        { workflowId: params.workflowId, workspaceId: loaded.workspaceId },
        { definition: executable.data, publishedBy: ctx.userId }
      );

      await recordAuditSafely(ctx, {
        targetId: updated.id,
        workspaceId: updated.workspaceId,
        oldObject: toAuditSnapshot(loaded, ctx.auditRedactionKey),
        newObject: toAuditSnapshot(updated, ctx.auditRedactionKey),
      });
      await recordAnalyticsSafely(
        ctx,
        toAnalyticsDetail("enabled", updated, { previousStatus: loaded.status })
      );

      return dataResponse(validateOutput(ZWorkflowResource, toWorkflowResource(updated)), ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },

  async disable({ ctx, params }) {
    try {
      const loaded = await loadAndAuthorize(service, ctx, params.workflowId, "readWrite");
      if (loaded instanceof Response) return loaded;
      if (loaded.status !== "enabled") {
        throw new WorkflowInvalidStateError("Only enabled workflows can be disabled.");
      }

      const updated = await service.disableWorkflow({
        workflowId: params.workflowId,
        workspaceId: loaded.workspaceId,
      });

      await recordAuditSafely(ctx, {
        targetId: updated.id,
        workspaceId: updated.workspaceId,
        oldObject: toAuditSnapshot(loaded, ctx.auditRedactionKey),
        newObject: toAuditSnapshot(updated, ctx.auditRedactionKey),
      });
      await recordAnalyticsSafely(
        ctx,
        toAnalyticsDetail("disabled", updated, { previousStatus: loaded.status })
      );

      return dataResponse(validateOutput(ZWorkflowResource, toWorkflowResource(updated)), ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },

  /**
   * Dry-run (test) a workflow: validate that its live definition would execute and that the
   * trigger's referenced survey + ending cards still resolve. No run is created and no side
   * effects occur — this is a pure pre-flight check the author can use before enabling. Unlike
   * `enable`, problems are *collected* (not thrown on the first one) so every issue is reported in
   * one pass; an `ok: false` result is still a 200 (the request succeeded; the workflow is just not
   * ready). Reuses the same executability + survey + recipient-allowlist checks as `enable`, so a
   * dry run that reports no problems is exactly the set of conditions under which enable succeeds.
   */
  async testWorkflow({ ctx, params }) {
    try {
      // "read", not "readWrite": as the doc comment above says, this validates the definition and
      // resolves its trigger references — nothing is executed and no run is created, so there is no
      // side effect to gate on. The MCP test_workflow tool is registered workflows:read and
      // annotated readOnlyHint, so requiring write here 403'd every read-scoped caller on a tool
      // that writes nothing (ENG-2223). Raising this back means moving that tool's scope with it.
      const loaded = await loadAndAuthorize(service, ctx, params.workflowId, "read");
      if (loaded instanceof Response) return loaded;
      // Drafts are testable too — the whole point of a dry run is checking the setup BEFORE going
      // live. Only archived workflows are rejected: they are soft-deleted.
      if (loaded.status === "archived") {
        throw new WorkflowInvalidStateError("Archived workflows cannot be tested.");
      }

      const problems: TWorkflowTestProblem[] = [];

      // safeParse + collect every issue, rather than throwing on the first (as enable does).
      const executable = ZWorkflowExecutableDefinition.safeParse(loaded.definition);
      if (!executable.success) {
        for (const issue of executable.error.issues) {
          problems.push({
            code: "definition_not_executable",
            field: issue.path.map(String).join(".") || "definition",
            message: issue.message,
          });
        }
      }

      // Trigger references are only checked when the definition parses, reading from the validated
      // `executable.data` (never the raw persisted JSON): a malformed/legacy row already surfaced as
      // `definition_not_executable` above, and dereferencing its unparsed config here would throw and
      // turn the dry-run into a 500 — the opposite of the collected-problems contract. Mirrors `enable`.
      if (executable.success) {
        const { surveyId, endingCardIds } = executable.data.trigger.config;
        const surveyCheck = await ctx.verifyTriggerSurvey({
          workspaceId: loaded.workspaceId,
          surveyId,
          endingCardIds,
        });
        if (!surveyCheck.surveyExists) {
          problems.push({
            code: "survey_not_found",
            field: "definition.trigger.config.surveyId",
            message: "The referenced survey does not exist in this workspace.",
          });
        }
        for (const endingCardId of surveyCheck.missingEndingCardIds) {
          problems.push({
            code: "ending_card_not_found",
            field: "definition.trigger.config.endingCardIds",
            message: `Ending card ${endingCardId} does not exist on the survey.`,
          });
        }

        // Recipient allowlist (ENG-2029): the same gate `enable` enforces, collected here as a
        // problem instead of thrown. The dry run exists to surface exactly this before going live —
        // without it a workflow addressing an external inbox tests green and then hard-fails enable.
        const literalRecipients = collectLiteralRecipientEmails(executable.data);
        if (literalRecipients.length > 0) {
          const { disallowedEmails } = await ctx.verifyRecipientsAllowed({
            workspaceId: loaded.workspaceId,
            emails: literalRecipients,
          });
          for (const email of disallowedEmails) {
            problems.push({
              code: "recipient_not_allowed",
              field: DISALLOWED_RECIPIENT_FIELD,
              message: disallowedRecipientMessage(email),
            });
          }
        }
      }

      const result = validateOutput(ZWorkflowTestResult, {
        workflowId: params.workflowId,
        ok: problems.length === 0,
        problems,
      });

      await recordAnalyticsSafely(ctx, toAnalyticsDetail("tested", loaded, { testOk: result.ok }));

      return dataResponse(result, ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },

  async listRuns({ req, ctx }) {
    try {
      const input = parseListWorkflowRunsQuery(new URL(req.url).searchParams);

      const authorized = await ctx.authorize(input.workspaceId, "read");
      if (authorized instanceof Response) return authorized;

      const runPage = await service.listWorkflowRuns({ ...input, workspaceId: authorized.workspaceId });

      const page = validateOutput(ZWorkflowRunListPage, {
        data: runPage.runs.map(toWorkflowRunListItem),
        meta: { limit: input.limit, nextCursor: runPage.nextCursor },
      });

      return listResponse(page.data, page.meta, ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },

  async getRun({ ctx, params }) {
    try {
      // Load by id, then authorize against the run's workspace — an unknown / cross-workspace runId
      // is rejected with 403 (never 404), matching the by-id workflow handlers and never leaking
      // existence. The detail read carries the full run + ordered step logs.
      const run = await service.getWorkflowRun(params.runId);
      if (!run) throw new WorkflowForbiddenError();

      const authorized = await ctx.authorize(run.workspaceId, "read");
      if (authorized instanceof Response) return authorized;

      return dataResponse(validateOutput(ZWorkflowRunResource, toWorkflowRunResource(run)), ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },
});
