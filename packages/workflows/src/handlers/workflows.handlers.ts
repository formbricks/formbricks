import {
  summarizeWorkflowDefinition,
  summarizeWorkflowDefinitionOptions,
} from "../analytics/definition-summary";
import {
  type TWorkflowIdInput,
  type TWorkflowRunIdInput,
  type TWorkflowTestProblem,
  type TWorkflowWarning,
  ZCreateWorkflowInput,
  ZDuplicateWorkflowInput,
  ZPatchWorkflowInput,
  ZWorkflowListItem,
  ZWorkflowResource,
  ZWorkflowRunListItem,
  ZWorkflowRunResource,
  ZWorkflowTestResult,
  zCursorPage,
  zWorkflowListPage,
} from "../contracts";
import {
  WorkflowForbiddenError,
  type WorkflowInvalidParam,
  WorkflowInvalidStateError,
  WorkflowNotExecutableError,
  toProblemResponse,
  validateOutput,
} from "../errors";
import { isLiteralEmailRecipient } from "../recipients";
import { createdResponse, dataResponse, listResponse, noContentResponse } from "../responses";
import {
  applyWorkflowSecretHeaderWrites,
  collectWorkflowSecretIds,
  dropWorkflowSecretIds,
  hasWorkflowSecretHeaderValues,
  withoutWorkflowSecretHeaderValues,
} from "../secret-headers/headers";
import type { WorkflowRowWithLastRun } from "../services/ports";
import type { WorkflowsService } from "../services/workflows.service";
import {
  type TWorkflowDefinition,
  type TWorkflowExecutableDefinition,
  ZWorkflowExecutableDefinition,
} from "../types/document";
import { WORKFLOW_TRIGGERS } from "../types/triggers/enum";
import type {
  TWorkflowSecretHeaderChange,
  TriggerSurveyCheck,
  WorkflowAnalyticsDetail,
  WorkflowAnalyticsOperation,
  WorkflowApiContext,
} from "./context";
import { parseListWorkflowRunsQuery, parseListWorkflowsQuery } from "./parse-list-query";
import {
  toWorkflowListItem,
  toWorkflowResource,
  toWorkflowRunListItem,
  toWorkflowRunResource,
} from "./serializers";
import { loadAndAuthorize, readJsonBody, recordAuditSafely, toAuditSnapshot } from "./shared";
import { checkWorkflowSurveyLinks } from "./survey-link-checks";
import { type TestRunHandlers, createTestRunHandlers } from "./test-run.handlers";
import { type WebhookHandlers, createWebhookHandlers } from "./webhook.handlers";

const ZWorkflowListPage = zWorkflowListPage(ZWorkflowListItem);
const ZWorkflowRunListPage = zCursorPage(ZWorkflowRunListItem);

/** Refuses up front a write whose secret values could only be kept by storing them in the definition. */
const assertSecretStoreFor = (ctx: WorkflowApiContext, definition: TWorkflowDefinition): void => {
  if (!ctx.secrets && hasWorkflowSecretHeaderValues(definition)) {
    throw new Error("Secret header values can't be stored: no secret store is configured");
  }
};

/** "Secret set" / "secret replaced" audit events, header names only; never fails the write. */
const recordSecretHeaderChangesSafely = async (
  ctx: WorkflowApiContext,
  scope: { workflowId: string; workspaceId: string },
  changes: TWorkflowSecretHeaderChange[]
): Promise<void> => {
  if (changes.length === 0 || !ctx.recordSecretHeaderChanges) return;
  try {
    await ctx.recordSecretHeaderChanges({ ...scope, changes });
  } catch (error) {
    ctx.logger.error({ error, workflowId: scope.workflowId }, "Failed to record workflow secret audit");
  }
};

/**
 * After Enable, deletes the workflow's secret rows that nothing references any more. Best effort: a
 * left-over row is harmless (unreachable and encrypted), so a failure here never fails the Enable.
 */
const deleteUnreferencedSecretsSafely = async (
  ctx: WorkflowApiContext,
  row: WorkflowRowWithLastRun,
  definition: TWorkflowExecutableDefinition
): Promise<void> => {
  if (!ctx.secrets) return;
  try {
    await ctx.secrets.deleteUnreferenced({
      workflowId: row.id,
      workspaceId: row.workspaceId,
      referencedSecretIds: collectWorkflowSecretIds(definition),
    });
  } catch (error) {
    ctx.logger.warn({ error, workflowId: row.id }, "Failed to delete unreferenced workflow secrets");
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
    if (node.type === "action" && node.actionType === "send_email") {
      const { to } = node.config;
      if (typeof to === "string" && isLiteralEmailRecipient(to)) {
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

/** Short 422 `detail` for a survey link that can't be built, so UI surfacing only `detail` names the cause. */
const SURVEY_LINK_DETAIL = "A send_email survey link does not point to a link survey in this workspace.";

const buildDisallowedRecipientParams = (disallowedEmails: string[]): WorkflowInvalidParam[] =>
  disallowedEmails.map((email) => ({
    name: DISALLOWED_RECIPIENT_FIELD,
    reason: disallowedRecipientMessage(email),
  }));

/** Map a failed trigger-survey check to field-level `invalid_params` on the definition's trigger config. */
const SURVEY_NOT_WORKSPACE_VISIBLE_REASON =
  "The referenced survey is not visible to the whole workspace, so workflows cannot use it.";

const buildSurveyInvalidParams = (check: TriggerSurveyCheck): WorkflowInvalidParam[] => {
  const invalidParams: WorkflowInvalidParam[] = [];
  if (!check.surveyExists) {
    invalidParams.push({
      name: "definition.trigger.config.surveyId",
      reason: "The referenced survey does not exist in this workspace.",
    });
  }
  if (check.surveyNotWorkspaceVisible) {
    invalidParams.push({
      name: "definition.trigger.config.surveyId",
      reason: SURVEY_NOT_WORKSPACE_VISIBLE_REASON,
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
 * The dry run's trigger-reference problems: the bound survey and ending cards of a Response completed
 * trigger. A Webhook trigger references nothing, so it has none.
 */
const collectTriggerSurveyProblems = async (
  ctx: WorkflowApiContext,
  workspaceId: string,
  definition: TWorkflowExecutableDefinition
): Promise<TWorkflowTestProblem[]> => {
  const { trigger } = definition;
  if (trigger.triggerType !== WORKFLOW_TRIGGERS.RESPONSE_COMPLETED) return [];

  const { surveyId, endingCardIds } = trigger.config;
  const surveyCheck = await ctx.verifyTriggerSurvey({ workspaceId, surveyId, endingCardIds });
  const problems: TWorkflowTestProblem[] = [];
  if (!surveyCheck.surveyExists) {
    problems.push({
      code: "survey_not_found",
      field: "definition.trigger.config.surveyId",
      message: "The referenced survey does not exist in this workspace.",
    });
  }
  if (surveyCheck.surveyNotWorkspaceVisible) {
    problems.push({
      code: "survey_not_workspace_visible",
      field: "definition.trigger.config.surveyId",
      message: SURVEY_NOT_WORKSPACE_VISIBLE_REASON,
    });
  }
  for (const endingCardId of surveyCheck.missingEndingCardIds) {
    problems.push({
      code: "ending_card_not_found",
      field: "definition.trigger.config.endingCardIds",
      message: `Ending card ${endingCardId} does not exist on the survey.`,
    });
  }
  return problems;
};

/** The survey a Response completed trigger is bound to; a Webhook trigger (or none) has no survey. */
const getTriggerSurveyId = (definition?: TWorkflowDefinition): string | undefined =>
  definition?.trigger?.triggerType === WORKFLOW_TRIGGERS.RESPONSE_COMPLETED
    ? definition.trigger.config.surveyId
    : undefined;

/**
 * Attach-time guard (ENG-3283): a workflow forwards its trigger survey's responses out of the app, so it
 * may only be bound to a survey the whole workspace can see. Checked when a binding is created — create,
 * duplicate, and a patch that points the trigger at another survey — so the refusal is immediate; enable
 * and dispatch re-check, since a survey restricted after it was bound stays bound (as for every other
 * outbound connection). Existence is not checked here: a draft may still name a survey being built.
 */
const assertTriggerSurveyAttachable = async (
  ctx: WorkflowApiContext,
  workspaceId: string,
  definition: TWorkflowDefinition,
  previous?: TWorkflowDefinition
): Promise<void> => {
  const surveyId = getTriggerSurveyId(definition);
  if (!surveyId || surveyId === getTriggerSurveyId(previous)) return;

  const check = await ctx.verifyTriggerSurvey({ workspaceId, surveyId, endingCardIds: [] });
  if (check.surveyNotWorkspaceVisible) {
    throw new WorkflowNotExecutableError(
      [{ name: "definition.trigger.config.surveyId", reason: SURVEY_NOT_WORKSPACE_VISIBLE_REASON }],
      SURVEY_NOT_WORKSPACE_VISIBLE_REASON
    );
  }
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

export interface WorkflowsHandlers extends WebhookHandlers, TestRunHandlers {
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
  ...createWebhookHandlers(service),
  ...createTestRunHandlers(service),

  async list({ req, ctx }) {
    try {
      const input = parseListWorkflowsQuery(new URL(req.url).searchParams);

      const authorized = await ctx.authorize(input.workspaceId, "read");
      if (authorized instanceof Response) return authorized;

      const workflowPage = await service.listWorkflows({ ...input, workspaceId: authorized.workspaceId });

      const page = validateOutput(ZWorkflowListPage, {
        data: workflowPage.workflows.map(toWorkflowListItem),
        meta: {
          limit: input.limit,
          nextCursor: workflowPage.nextCursor,
          totalCount: workflowPage.totalCount,
        },
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
      await assertTriggerSurveyAttachable(ctx, authorized.workspaceId, input.definition);
      assertSecretStoreFor(ctx, input.definition);

      // A secret value needs the workflow's id to be stored, so the workflow is created without its
      // secret values first, then pointed at the stored rows. If that second write fails, the copy
      // that exists just has unset secret headers, which block Enable.
      let created = await service.createWorkflow(
        {
          ...input,
          workspaceId: authorized.workspaceId,
          definition: withoutWorkflowSecretHeaderValues(input.definition),
        },
        { createdBy: ctx.userId }
      );
      if (hasWorkflowSecretHeaderValues(input.definition)) {
        const scope = { workflowId: created.id, workspaceId: created.workspaceId };
        const secrets = await applyWorkflowSecretHeaderWrites({
          definition: input.definition,
          stored: null,
          store: ctx.secrets,
          ...scope,
        });
        created = await service.updateWorkflow(scope, { definition: secrets.definition });
        await recordSecretHeaderChangesSafely(ctx, scope, secrets.changes);
      }

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
      if (input.definition !== undefined) {
        await assertTriggerSurveyAttachable(ctx, loaded.workspaceId, input.definition, loaded.definition);
        assertSecretStoreFor(ctx, input.definition);
      }

      const scope = { workflowId: params.workflowId, workspaceId: loaded.workspaceId };
      const secrets =
        input.definition === undefined
          ? null
          : await applyWorkflowSecretHeaderWrites({
              definition: input.definition,
              stored: loaded.definition,
              store: ctx.secrets,
              ...scope,
            });
      // The Secret URL token is created on the first save of a Webhook trigger and kept afterwards,
      // even if the trigger changes, so switching back keeps the same URL.
      const issueWebhookToken =
        input.definition?.trigger?.triggerType === WORKFLOW_TRIGGERS.WEBHOOK && !loaded.webhookTokenHash;
      const updated = await service.updateWorkflow(scope, {
        ...input,
        ...(secrets ? { definition: secrets.definition } : {}),
        issueWebhookToken,
      });
      if (secrets) await recordSecretHeaderChangesSafely(ctx, scope, secrets.changes);

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
      // The copy is a new binding of the same survey, so it is refused like a new workflow would be.
      await assertTriggerSurveyAttachable(ctx, loaded.workspaceId, loaded.definition);
      // The copy keeps its secret headers' names but not their values (ADR 0043): sharing the rows
      // would let a Replace on the copy change the original's secret.
      const created = await service.duplicateWorkflow(
        { ...loaded, definition: dropWorkflowSecretIds(loaded.definition) },
        { name: input.name, createdBy: ctx.userId }
      );

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

      // Only a Response completed trigger references a survey; a Webhook trigger has nothing to resolve.
      const { trigger } = executable.data;
      if (trigger.triggerType === WORKFLOW_TRIGGERS.RESPONSE_COMPLETED) {
        const { surveyId, endingCardIds } = trigger.config;
        const surveyCheck = await ctx.verifyTriggerSurvey({
          workspaceId: loaded.workspaceId,
          surveyId,
          endingCardIds,
        });
        if (
          !surveyCheck.surveyExists ||
          surveyCheck.surveyNotWorkspaceVisible ||
          surveyCheck.missingEndingCardIds.length > 0
        ) {
          throw new WorkflowNotExecutableError(buildSurveyInvalidParams(surveyCheck));
        }
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

      // Survey links (ENG-7180): a linked survey must be a link survey in this workspace; Embedded
      // Data keys it doesn't accept only warn, since the link simply leaves them off.
      const surveyLinks = await checkWorkflowSurveyLinks(executable.data, loaded.workspaceId, ctx);
      if (surveyLinks.problems.length > 0) {
        throw new WorkflowNotExecutableError(
          surveyLinks.problems.map((problem) => ({ name: problem.field, reason: problem.message })),
          SURVEY_LINK_DETAIL
        );
      }

      const updated = await service.enableWorkflow(
        { workflowId: params.workflowId, workspaceId: loaded.workspaceId },
        { definition: executable.data, publishedBy: ctx.userId }
      );
      await deleteUnreferencedSecretsSafely(ctx, updated, executable.data);

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

      return dataResponse(
        validateOutput(ZWorkflowResource, toWorkflowResource(updated)),
        ctx.requestId,
        surveyLinks.warnings.length > 0 ? { warnings: surveyLinks.warnings } : undefined
      );
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
      const warnings: TWorkflowWarning[] = [];

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
        problems.push(...(await collectTriggerSurveyProblems(ctx, loaded.workspaceId, executable.data)));

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

        const surveyLinks = await checkWorkflowSurveyLinks(executable.data, loaded.workspaceId, ctx);
        problems.push(...surveyLinks.problems);
        warnings.push(...surveyLinks.warnings);
      }

      const result = validateOutput(ZWorkflowTestResult, {
        workflowId: params.workflowId,
        ok: problems.length === 0,
        problems,
        warnings,
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

      // ENG-3282: one batched visibility lookup per page, applied in the query so pages stay full and the
      // cursor stays exact.
      const excludeSurveyIds = await ctx.listUnreadableSurveyIds({
        workspaceId: authorized.workspaceId,
        organizationId: authorized.organizationId,
      });
      const runPage = await service.listWorkflowRuns({
        ...input,
        workspaceId: authorized.workspaceId,
        excludeSurveyIds,
      });

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

      // ENG-3282: the run carries its trigger survey's response data, so a caller who may not read
      // that survey gets the same 403 as an unknown run.
      if (run.surveyId) {
        const unreadable = await ctx.listUnreadableSurveyIds({
          workspaceId: authorized.workspaceId,
          organizationId: authorized.organizationId,
          surveyIds: [run.surveyId],
        });
        if (unreadable.includes(run.surveyId)) throw new WorkflowForbiddenError();
      }

      return dataResponse(validateOutput(ZWorkflowRunResource, toWorkflowRunResource(run)), ctx.requestId);
    } catch (error) {
      return toProblemResponse(error, ctx);
    }
  },
});
