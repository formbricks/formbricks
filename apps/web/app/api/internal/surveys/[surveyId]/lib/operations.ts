import "server-only";
import { revalidatePath } from "next/cache";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
  UniqueConstraintError,
  ValidationError,
} from "@formbricks/types/errors";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { refusalResponse } from "@/app/api/internal/lib/refusal";
import { requireSurveyActionAccess } from "@/app/api/internal/lib/survey-access";
import type { TRequestContext } from "@/app/api/internal/lib/types";
import { applyRateLimitOrRespond, rateLimitedResponse } from "@/app/api/v3/lib/operation-rate-limit";
import { problemBadRequest, problemConflict, successResponse } from "@/app/api/v3/lib/response";
import { IS_FORMBRICKS_SURVEYS_CONFIGURED, POSTHOG_KEY } from "@/lib/constants";
import { capturePostHogEvent } from "@/lib/posthog";
import { resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { getOrganizationIdFromSurveyId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { SurveyLinkedCreativesError } from "@/modules/ee/creatives/lib/linked-creatives";
import { checkExternalUrlsPermission } from "@/modules/survey/editor/lib/check-external-urls-permission";
import { updateSurvey, updateSurveyDraft } from "@/modules/survey/editor/lib/survey";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { assertCanWriteCustomHeadScripts } from "@/modules/survey/lib/custom-head-scripts-permission";
import { checkSpamProtectionPermission } from "@/modules/survey/lib/permission";
import { getOrganizationBilling, getSurvey } from "@/modules/survey/lib/survey";
import { getSurveyCount } from "@/modules/survey/list/lib/survey";
import type { TSurveyDraftSaveBody, TSurveySaveBody } from "../schemas";
import { captureSurveyEditDiffEvents } from "./edit-events";

/**
 * The survey editor's saves: `PUT /api/internal/surveys/{surveyId}` (save, publish, schedule and the
 * summary page's status and share settings) and `PUT …/draft` (the draft save and the 10-second
 * autosave). They replace `updateSurveyAction` and `updateSurveyDraftAction` and keep their checks, in
 * their order: `survey.write` on the survey, the workspace's state-mutation budget, then the gates that
 * only refuse new content (spam protection, follow-ups, external URLs, custom head scripts), and the
 * write charged to the user's custom CSS budget. Each is audited as `updated` on the survey, with the
 * survey before and after.
 */

type TSaveContext = TRequestContext & { surveyId: string };

/** What the checks resolved, for the write and its events. */
type TSaveScope = {
  userId: string;
  organizationId: string;
  workspaceId: string;
  oldSurvey: TSurvey;
};

/**
 * Checks if survey follow-ups can be added for the given organization.
 * Grandfathers existing follow-ups (allows keeping them even if the org lost access).
 * Only throws when new follow-ups are being added.
 */
const checkSurveyFollowUpsPermission = async (
  organizationId: string,
  newFollowUpIds: string[],
  oldFollowUpIds: Set<string>
): Promise<void> => {
  const organizationBilling = await getOrganizationBilling(organizationId);
  if (!organizationBilling) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const isSurveyFollowUpsEnabled = await getSurveyFollowUpsPermission(organizationId);
  if (isSurveyFollowUpsEnabled) return;

  for (const id of newFollowUpIds) {
    if (!oldFollowUpIds.has(id)) {
      throw new OperationNotAllowedError("Survey follow ups are not enabled for this organization");
    }
  }
};

/**
 * A refusal raised by the checks or the write, as the problem that keeps the message the editor's toast
 * showed: a gate's reason (403), a write the service can't take (422), a schedule whose dates don't fit
 * (400; the only `ValidationError`s on this path check the caller's survey), a change creatives block
 * (409), a taken unique value (409), and the custom CSS budget (429). `null` for a fault, which the
 * wrapper answers with a 500.
 */
const saveRefusal = (error: unknown, { requestId, instance }: TSaveContext): Response | null => {
  const refused = refusalResponse(error, requestId, instance);
  if (refused) return refused;
  if (error instanceof ValidationError) {
    return problemBadRequest(requestId, error.message, {
      instance,
      invalid_params: [{ name: "body", reason: error.message }],
    });
  }
  if (error instanceof SurveyLinkedCreativesError || error instanceof UniqueConstraintError) {
    return problemConflict(requestId, error.message, instance);
  }
  if (error instanceof TooManyRequestsError) return rateLimitedResponse(error, { requestId, instance });
  return null;
};

/** The body names the survey it saves; it has to be the one in the path, which is the one authorized. */
const mismatchedSurveyId = ({ requestId, instance }: TSaveContext): Response =>
  problemBadRequest(requestId, "The survey id in the body must match the survey in the path", {
    instance,
    invalid_params: [{ name: "id", reason: "Must match the survey in the path" }],
  });

/**
 * The checks every save runs before it writes, refused with the problem the server actions' messages map
 * to. `followUps` is read the way each action read it: the draft action assumed the key was there.
 */
async function authorizeSave(
  context: TSaveContext,
  survey: TSurvey,
  hasFollowUps: boolean
): Promise<Response | TSaveScope> {
  const { authentication, surveyId, requestId, instance, auditLog } = context;
  if (survey.id !== surveyId) return mismatchedSurveyId(context);

  if (auditLog) auditLog.targetId = surveyId;
  const access = await requireSurveyActionAccess({
    authentication,
    surveyId,
    action: "survey.write",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;
  const { userId } = access;

  const organizationId = await getOrganizationIdFromSurveyId(surveyId);
  const workspaceId = await getWorkspaceIdFromSurveyId(surveyId);
  if (auditLog) auditLog.organizationId = organizationId;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, workspaceId, {
    requestId,
    instance,
  });
  if (limited) return limited;

  if (survey.recaptcha?.enabled) {
    await checkSpamProtectionPermission(organizationId);
  }

  const oldSurvey = await getSurvey(surveyId);

  if (hasFollowUps) {
    const oldFollowUpIds = new Set((oldSurvey?.followUps ?? []).map((f) => f.id));
    await checkSurveyFollowUpsPermission(
      organizationId,
      survey.followUps.map((f) => f.id),
      oldFollowUpIds
    );
  }

  // Check external URLs permission (with grandfathering)
  await checkExternalUrlsPermission(organizationId, survey, oldSurvey);
  await assertCanWriteCustomHeadScripts({ type: "user", id: userId }, workspaceId, survey, oldSurvey);

  return { userId, organizationId, workspaceId, oldSurvey };
}

/** The write's options: custom CSS charged to the user, and targeting checked against what they can see. */
const writeOptions = async ({ userId, organizationId }: TSaveScope) => ({
  customCssPrincipal: userId,
  targetingActor: await resolveSurveyActorContext({ type: "user", id: userId }, organizationId),
});

/** Runs a save, answering a refusal from its checks or its write with `saveRefusal`. */
async function runSave(context: TSaveContext, save: () => Promise<Response>): Promise<Response> {
  try {
    return await save();
  } catch (error) {
    const refused = saveRefusal(error, context);
    if (refused) return refused;
    throw error;
  }
}

/** The full save's PostHog events, past the diff events: whether the save published or updated a live survey. */
const captureSaveEvents = (
  userId: string,
  organizationId: string,
  saved: TSurvey,
  isPublish: boolean
): void => {
  if (!POSTHOG_KEY || saved.status === "draft") return;

  const posthogEventMetadata = {
    survey_id: saved.id,
    survey_type: saved.type,
    question_count: getElementsFromBlocks(saved.blocks).length,
    organization_id: organizationId,
    workspace_id: saved.workspaceId,
    has_targeting: saved.segment ? !saved.segment.isPrivate : false,
    language_count: saved.languages?.length ?? 0,
  };
  const groupContext = { organizationId, workspaceId: saved.workspaceId };

  if (isPublish) {
    capturePostHogEvent(userId, "survey_published", posthogEventMetadata, groupContext);
  }
  capturePostHogEvent(userId, "survey_updated", posthogEventMetadata, groupContext);
};

/**
 * Whether this publish is the user's second, so the editor can fire an in-app code action. Counted only
 * on a genuine draft-to-live publish, over the user's own surveys so it holds in a shared workspace, and
 * only where the in-app surveys are configured, so it costs no query otherwise.
 */
const isSecondPublish = async (
  { userId, organizationId }: TSaveScope,
  saved: TSurvey,
  isPublish: boolean
): Promise<boolean> => {
  if (!isPublish || !IS_FORMBRICKS_SURVEYS_CONFIGURED) return false;
  const publishedCount = await getSurveyCount(
    saved.workspaceId,
    {
      status: ["inProgress", "paused", "completed"],
      createdBy: { userId, value: ["you"] },
    },
    await resolveSurveyActorContext({ type: "user", id: userId }, organizationId)
  );
  return publishedCount === 2;
};

/**
 * `PUT /api/internal/surveys/{surveyId}`: save the whole survey, validated in full. Publishing, scheduling
 * and a status change are saves with a new status. Answers the saved survey and `isSecondPublish`, and
 * marks the survey's page for revalidation.
 */
export async function saveSurveyOperation({
  body,
  ...context
}: TSaveContext & { body: TSurveySaveBody }): Promise<Response> {
  return runSave(context, async () => {
    const scope = await authorizeSave(context, body, Boolean(body.followUps?.length));
    if (scope instanceof Response) return scope;
    const { userId, organizationId, oldSurvey } = scope;

    const saved = await updateSurvey(body, await writeOptions(scope));
    if (context.auditLog) {
      context.auditLog.oldObject = oldSurvey;
      context.auditLog.newObject = saved;
    }

    captureSurveyEditDiffEvents(oldSurvey, saved, {
      userId,
      surveyId: saved.id,
      organizationId,
      workspaceId: saved.workspaceId,
    });

    const isPublish = oldSurvey?.status === "draft" && saved.status === "inProgress";
    captureSaveEvents(userId, organizationId, saved, isPublish);
    const secondPublish = await isSecondPublish(scope, saved, isPublish);

    revalidatePath(`/workspaces/${saved.workspaceId}/surveys/${saved.id}`);

    return successResponse({ ...saved, isSecondPublish: secondPublish }, { requestId: context.requestId });
  });
}

/**
 * `PUT /api/internal/surveys/{surveyId}/draft`: save a draft as it stands, without the full validation a
 * publish runs. The autosave's path, so it does not revalidate the page: the manual draft save refreshes
 * the route itself.
 */
export async function saveSurveyDraftOperation({
  body,
  ...context
}: TSaveContext & { body: TSurveyDraftSaveBody }): Promise<Response> {
  // `ZSurveyDraft` checks the structure a draft needs; the rest is checked in full on publish.
  const survey = body as TSurvey;

  return runSave(context, async () => {
    const scope = await authorizeSave(context, survey, survey.followUps.length > 0);
    if (scope instanceof Response) return scope;
    const { userId, organizationId, oldSurvey } = scope;

    const saved = await updateSurveyDraft(survey, await writeOptions(scope));
    if (context.auditLog) {
      context.auditLog.oldObject = oldSurvey;
      context.auditLog.newObject = saved;
    }

    captureSurveyEditDiffEvents(oldSurvey, saved, {
      userId,
      surveyId: saved.id,
      organizationId,
      workspaceId: saved.workspaceId,
    });

    return successResponse(saved, { requestId: context.requestId });
  });
}
