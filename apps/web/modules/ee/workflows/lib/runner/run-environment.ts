import "server-only";
import type { TResponse } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  type TWorkflowExecutableDefinition,
  type TWorkflowRunContext,
  type TWorkflowTriggerRunPayload,
  collectWorkflowSecretIds,
  isLiteralEmailRecipient,
} from "@formbricks/workflows";
import type { SurveyLinkSurveyCheck } from "@formbricks/workflows/server";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { isSurveyOutboundAllowed } from "@/lib/survey/visibility/outbound";
import { getWorkspaceMemberEmails } from "@/lib/workspace/service";
import { loadWorkflowSecretValues } from "@/modules/ee/workflows/lib/secrets/workflow-secret-store";
import { resolveEmailActorUserId } from "@/modules/email/lib/email-actor";
import { recordSurveyOutboundSkipped } from "@/modules/response-pipeline/lib/outbound-visibility-metrics";
import { getWorkflowSurveyLinkSurveys } from "../survey-link-surveys";

/** Thrown when the run cannot be executed at all (definition, survey or response unusable). Fails the run. */
export class WorkflowRunNotExecutableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowRunNotExecutableError";
  }
}

/** The survey response a Response completed run was started by, with the survey it belongs to. */
export interface WorkflowRunSurveyResponse {
  survey: TSurvey;
  response: TResponse;
}

/** What a run's steps run against, loaded once per run before the first step. */
export interface WorkflowRunEnvironment {
  runId: string;
  workflowId: string;
  workspaceId: string;
  /** The workflow's creator, recorded on outgoing email audits. */
  configuredByUserId?: string;
  /** Only for Response completed runs; a run started any other way has none. */
  surveyResponse: WorkflowRunSurveyResponse | null;
  /** Only for Webhook runs: the JSON object the Webhook Secret URL call delivered (ENG-7177). */
  payload?: Record<string, unknown>;
  logoUrl: string;
  /**
   * Lowercased emails of everyone who can access this run's workspace. A literal `to` recipient must
   * be in this set (ENG-2029, ENG-2186). Loaded only when a step has a literal recipient; empty
   * otherwise, which fails closed.
   */
  allowedRecipientEmails: Set<string>;
  /**
   * Plaintext secret header values by secret id, for this run's HTTP request steps (ENG-7179). Loaded
   * only when a step has a secret header; scoped to this workflow, so another workflow's id resolves to
   * nothing.
   */
  secretValues: ReadonlyMap<string, string>;
  /** The organization and workflow owner the run's emails are rate-limited by (ENG-3823). */
  rateLimit: { organizationId?: string; actorUserId: string | null };
  /** Where survey links point: `<public domain>/s/<surveyId>`. */
  publicDomain: string;
  /**
   * The surveys `send_email` steps link to, by id, checked when the run starts (ENG-7180): a link
   * survey in this workspace, and the Embedded Data keys its link takes. Empty when no step links one.
   */
  surveyLinkSurveys: Map<string, SurveyLinkSurveyCheck>;
}

/**
 * Loads the survey and response of a Response completed run, with the tenant checks: the ids come
 * from the stored (untrusted) trigger payload, so they must belong to this run's workspace and survey.
 */
const loadSurveyResponse = async (
  trigger: Extract<TWorkflowTriggerRunPayload, { type: "response.completed" }>,
  workspaceId: string
): Promise<WorkflowRunSurveyResponse> => {
  const [response, survey] = await Promise.all([
    getResponse(trigger.responseId),
    getSurvey(trigger.surveyId),
  ]);

  if (!response) {
    throw new WorkflowRunNotExecutableError(`Response ${trigger.responseId} not found`);
  }
  if (!survey) {
    throw new WorkflowRunNotExecutableError(`Survey ${trigger.surveyId} not found`);
  }
  if (survey.workspaceId !== workspaceId) {
    throw new WorkflowRunNotExecutableError(
      `Survey ${trigger.surveyId} does not belong to workspace ${workspaceId}`
    );
  }
  if (response.surveyId !== trigger.surveyId) {
    throw new WorkflowRunNotExecutableError(
      `Response ${trigger.responseId} does not belong to survey ${trigger.surveyId}`
    );
  }

  // ENG-3283: the survey may have been restricted after this run was enqueued. A run forwards the
  // response out of the app, so it stops here rather than sending a restricted survey's data.
  if (!isSurveyOutboundAllowed(survey)) {
    recordSurveyOutboundSkipped("workflow");
    throw new WorkflowRunNotExecutableError(
      `Survey ${trigger.surveyId} is not visible to the whole workspace`
    );
  }

  return { survey, response };
};

/** The survey response a run reads, by trigger: only Response completed runs have one (ENG-7165). */
const loadTriggerSurveyResponse = (
  trigger: TWorkflowTriggerRunPayload,
  workspaceId: string
): Promise<WorkflowRunSurveyResponse | null> => {
  switch (trigger.type) {
    case "response.completed":
      return loadSurveyResponse(trigger, workspaceId);
    default:
      return Promise.resolve(null);
  }
};

const hasLiteralEmailRecipient = (definition: TWorkflowExecutableDefinition): boolean =>
  definition.nodes.some(
    (node) =>
      node.type === "action" && node.actionType === "send_email" && isLiteralEmailRecipient(node.config.to)
  );

const getLinkedSurveyIds = (definition: TWorkflowExecutableDefinition): string[] => [
  ...new Set(
    definition.nodes.flatMap((node) => {
      const config = node.type === "action" ? node.config : null;
      return config && "surveyLink" in config && config.surveyLink ? [config.surveyLink.surveyId] : [];
    })
  ),
];

const loadSurveyLinkSurveys = async (
  definition: TWorkflowExecutableDefinition,
  workspaceId: string
): Promise<Map<string, SurveyLinkSurveyCheck>> => {
  const checks = await getWorkflowSurveyLinkSurveys({
    workspaceId,
    surveyIds: getLinkedSurveyIds(definition),
  });
  return new Map(checks.map((check) => [check.surveyId, check]));
};

/**
 * Loads everything a run's steps need, independent loads together (ADR 0047): the survey response
 * (Response completed only), the organization, then the member allowlist and the rate-limit actor.
 * The member query runs only when a step has a literal recipient, scoped to the workspace like the
 * enable-time gate.
 */
export const loadWorkflowRunEnvironment = async ({
  runId,
  workflowId,
  workspaceId,
  trigger,
  definition,
  actorUserId,
}: {
  runId: string;
  workflowId: string;
  workspaceId: string;
  trigger: TWorkflowTriggerRunPayload;
  definition: TWorkflowExecutableDefinition;
  actorUserId: string | null;
}): Promise<WorkflowRunEnvironment> => {
  const [surveyResponse, organization, surveyLinkSurveys, secretValues] = await Promise.all([
    loadTriggerSurveyResponse(trigger, workspaceId),
    getOrganizationByWorkspaceId(workspaceId),
    loadSurveyLinkSurveys(definition, workspaceId),
    loadWorkflowSecretValues({ workflowId, workspaceId, secretIds: collectWorkflowSecretIds(definition) }),
  ]);

  const [allowedRecipientEmails, rateLimitActorUserId] = await Promise.all([
    hasLiteralEmailRecipient(definition) ? getWorkspaceMemberEmails(workspaceId) : new Set<string>(),
    organization ? resolveEmailActorUserId(actorUserId, organization.id) : actorUserId,
  ]);

  return {
    runId,
    workflowId,
    workspaceId,
    configuredByUserId: actorUserId ?? undefined,
    surveyResponse,
    ...(trigger.type === "webhook" ? { payload: trigger.payload } : {}),
    logoUrl: organization?.whitelabel?.logoUrl ?? "",
    allowedRecipientEmails,
    secretValues,
    rateLimit: { organizationId: organization?.id, actorUserId: rateLimitActorUserId },
    publicDomain: getPublicDomain(),
    surveyLinkSurveys,
  };
};

/**
 * The run context a run starts with (ADR 0045): the response's answers for `response.<questionId>`
 * (variables win over answers on a shared id, as in survey recall), a Webhook run's payload for
 * `payload.<path>` (ENG-7177), and no step outputs yet.
 */
export const createInitialRunContext = (environment: WorkflowRunEnvironment): TWorkflowRunContext => {
  const response = environment.surveyResponse?.response;
  return {
    steps: {},
    ...(response ? { response: { data: { ...response.data, ...response.variables } } } : {}),
    ...(environment.payload ? { payload: environment.payload } : {}),
  };
};
