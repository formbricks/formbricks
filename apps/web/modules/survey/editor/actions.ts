"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey, TSurveyVariable, ZSurvey } from "@formbricks/types/surveys/types";
import { assertCan } from "@/lib/authorization";
import { IS_FORMBRICKS_SURVEYS_CONFIGURED, POSTHOG_KEY } from "@/lib/constants";
import { capturePostHogEvent } from "@/lib/posthog";
import { resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromSurveyId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { checkExternalUrlsPermission } from "@/modules/survey/editor/lib/check-external-urls-permission";
import { updateSurvey, updateSurveyDraft } from "@/modules/survey/editor/lib/survey";
import { ZSurveyDraft } from "@/modules/survey/editor/types/survey";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { assertCanWriteCustomHeadScripts } from "@/modules/survey/lib/custom-head-scripts-permission";
import { checkSpamProtectionPermission } from "@/modules/survey/lib/permission";
import { getOrganizationBilling, getSurvey } from "@/modules/survey/lib/survey";
import { getSurveyCount } from "@/modules/survey/list/lib/survey";
import { getWorkspace, getWorkspaceLanguages } from "./lib/workspace";

type SurveyEditDiffContext = {
  userId: string;
  surveyId: string;
  organizationId: string;
  workspaceId: string;
};

const captureSurveyEditDiffEvents = (
  oldSurvey: TSurvey | null,
  newSurvey: TSurvey,
  context: SurveyEditDiffContext
): void => {
  if (!oldSurvey) return;

  const groupContext = { organizationId: context.organizationId, workspaceId: context.workspaceId };
  const baseProps = {
    organization_id: context.organizationId,
    workspace_id: context.workspaceId,
    survey_id: context.surveyId,
  };

  // hidden_field_added
  const oldFieldIds = new Set(oldSurvey.hiddenFields?.fieldIds ?? []);
  const newFieldIds = newSurvey.hiddenFields?.fieldIds ?? [];
  const addedFieldIds = newFieldIds.filter((id) => !oldFieldIds.has(id));
  if (addedFieldIds.length > 0) {
    capturePostHogEvent(
      context.userId,
      "hidden_field_added",
      { ...baseProps, field_count: newFieldIds.length },
      groupContext
    );
  }

  // conditional_logic_added (per block)
  const oldBlocks = oldSurvey.blocks ?? [];
  const newBlocks = newSurvey.blocks ?? [];
  const oldBlockLogic = new Map<string, number>(
    oldBlocks.map((b) => [b.id, (b.logic?.length ?? 0) + (b.logicFallback ? 1 : 0)])
  );
  for (const block of newBlocks) {
    const newLogicCount = (block.logic?.length ?? 0) + (block.logicFallback ? 1 : 0);
    const oldLogicCount = oldBlockLogic.get(block.id) ?? 0;
    if (newLogicCount > oldLogicCount) {
      capturePostHogEvent(
        context.userId,
        "conditional_logic_added",
        { ...baseProps, question_id: block.id },
        groupContext
      );
    }
  }

  // variable_created
  const oldVariableIds = new Set((oldSurvey.variables ?? []).map((v: TSurveyVariable) => v.id));
  for (const variable of newSurvey.variables ?? []) {
    if (!oldVariableIds.has(variable.id)) {
      capturePostHogEvent(
        context.userId,
        "variable_created",
        { ...baseProps, variable_type: variable.type },
        groupContext
      );
    }
  }

  // survey_language_enabled / survey_language_added
  const oldLanguages = oldSurvey.languages ?? [];
  const newLanguages = newSurvey.languages ?? [];
  const oldLanguageCodes = new Set(oldLanguages.map((l) => l.language.code));
  const addedLanguages = newLanguages.filter((l) => !oldLanguageCodes.has(l.language.code));

  if (addedLanguages.length > 0) {
    const wasMultiLangBefore = oldLanguages.length > 1;
    let currentCount = oldLanguages.length;

    if (!wasMultiLangBefore) {
      const [first, ...rest] = addedLanguages;
      capturePostHogEvent(
        context.userId,
        "survey_language_enabled",
        { ...baseProps, language_code: first.language.code, existing_language_count: currentCount },
        groupContext
      );
      currentCount++;
      for (const lang of rest) {
        capturePostHogEvent(
          context.userId,
          "survey_language_added",
          {
            ...baseProps,
            language_code: lang.language.code,
            existing_language_count: currentCount,
          },
          groupContext
        );
        currentCount++;
      }
    } else {
      for (const lang of addedLanguages) {
        capturePostHogEvent(
          context.userId,
          "survey_language_added",
          {
            ...baseProps,
            language_code: lang.language.code,
            existing_language_count: currentCount,
          },
          groupContext
        );
        currentCount++;
      }
    }
  }

  // follow_up_added
  const oldFollowUpIds = new Set((oldSurvey.followUps ?? []).map((f) => f.id));
  const newFollowUps = (newSurvey.followUps ?? []).filter((f) => !f.deleted);
  for (const followUp of newFollowUps) {
    if (!oldFollowUpIds.has(followUp.id)) {
      capturePostHogEvent(
        context.userId,
        "follow_up_added",
        { ...baseProps, follow_up_id: followUp.id },
        groupContext
      );
    }
  }
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

export const updateSurveyDraftAction = authenticatedActionClient.inputSchema(ZSurveyDraft).action(
  withAuditLogging("updated", "survey", async ({ ctx, parsedInput }) => {
    // Cast to TSurvey - ZSurveyDraft validates structure, full validation happens on publish
    const survey = parsedInput as TSurvey;

    const organizationId = await getOrganizationIdFromSurveyId(survey.id);
    const workspaceId = await getWorkspaceIdFromSurveyId(survey.id);
    await assertCan({ type: "user", id: ctx.user.id }, "survey.write", {
      type: "survey",
      id: survey.id,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, workspaceId);

    if (survey.recaptcha?.enabled) {
      await checkSpamProtectionPermission(organizationId);
    }

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.surveyId = survey.id;
    const oldObject = await getSurvey(survey.id);

    if (survey.followUps.length) {
      const oldFollowUpIds = new Set((oldObject?.followUps ?? []).map((f) => f.id));
      await checkSurveyFollowUpsPermission(
        organizationId,
        survey.followUps.map((f) => f.id),
        oldFollowUpIds
      );
    }

    await checkExternalUrlsPermission(organizationId, survey, oldObject);
    await assertCanWriteCustomHeadScripts({ type: "user", id: ctx.user.id }, workspaceId, survey, oldObject);

    // Use the draft version that skips validation. This is also the autosave's path, so custom CSS it
    // processes is charged to the user like a manual save.
    const result = await updateSurveyDraft(survey, {
      customCssPrincipal: ctx.user.id,
      targetingActor: await resolveSurveyActorContext({ type: "user", id: ctx.user.id }, organizationId),
    });

    ctx.auditLoggingCtx.oldObject = oldObject;
    ctx.auditLoggingCtx.newObject = result;

    captureSurveyEditDiffEvents(oldObject, result, {
      userId: ctx.user.id,
      surveyId: result.id,
      organizationId,
      workspaceId: result.workspaceId,
    });

    // No `revalidatePath` here: this is the autosave's path, and in Next 16 it re-renders the current
    // route whatever path it is given — the whole editor page, every 10s. The manual draft save
    // refreshes the route itself.
    return result;
  })
);

export const updateSurveyAction = authenticatedActionClient.inputSchema(ZSurvey).action(
  withAuditLogging("updated", "survey", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.id);
    const workspaceId = await getWorkspaceIdFromSurveyId(parsedInput.id);
    await assertCan({ type: "user", id: ctx.user.id }, "survey.write", {
      type: "survey",
      id: parsedInput.id,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, workspaceId);

    if (parsedInput.recaptcha?.enabled) {
      await checkSpamProtectionPermission(organizationId);
    }

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.surveyId = parsedInput.id;
    const oldObject = await getSurvey(parsedInput.id);

    if (parsedInput.followUps?.length) {
      const oldFollowUpIds = new Set((oldObject?.followUps ?? []).map((f) => f.id));
      await checkSurveyFollowUpsPermission(
        organizationId,
        parsedInput.followUps.map((f) => f.id),
        oldFollowUpIds
      );
    }

    // Check external URLs permission (with grandfathering)
    await checkExternalUrlsPermission(organizationId, parsedInput, oldObject);
    await assertCanWriteCustomHeadScripts(
      { type: "user", id: ctx.user.id },
      workspaceId,
      parsedInput,
      oldObject
    );
    const result = await updateSurvey(parsedInput, {
      customCssPrincipal: ctx.user.id,
      targetingActor: await resolveSurveyActorContext({ type: "user", id: ctx.user.id }, organizationId),
    });
    ctx.auditLoggingCtx.oldObject = oldObject;
    ctx.auditLoggingCtx.newObject = result;

    captureSurveyEditDiffEvents(oldObject, result, {
      userId: ctx.user.id,
      surveyId: result.id,
      organizationId,
      workspaceId: result.workspaceId,
    });

    const isPublish = oldObject?.status === "draft" && result.status === "inProgress";

    if (POSTHOG_KEY) {
      if (result.status !== "draft") {
        const posthogEventMetadata = {
          survey_id: result.id,
          survey_type: result.type,
          question_count: getElementsFromBlocks(result.blocks).length,
          organization_id: organizationId,
          workspace_id: result.workspaceId,
          has_targeting: result.segment ? !result.segment.isPrivate : false,
          language_count: result.languages?.length ?? 0,
        };

        const groupContext = { organizationId, workspaceId: result.workspaceId };

        if (isPublish) {
          capturePostHogEvent(ctx.user.id, "survey_published", posthogEventMetadata, groupContext);
          capturePostHogEvent(ctx.user.id, "survey_updated", posthogEventMetadata, groupContext);
        } else {
          capturePostHogEvent(ctx.user.id, "survey_updated", posthogEventMetadata, groupContext);
        }
      }
    }

    // Detect the acting user's second published survey so the editor can fire an in-app
    // code action. Computed here (only on a genuine draft→publish) to reuse the auth and
    // ids this action already resolved and avoid an extra client round-trip. Scoped to
    // the current user's own surveys so it's correct in shared workspaces. Gated on the
    // in-app surveys config so it's a true no-op (no extra count query) when the widget
    // isn't enabled, mirroring the POSTHOG_KEY gate above.
    let isSecondPublish = false;
    if (isPublish && IS_FORMBRICKS_SURVEYS_CONFIGURED) {
      const publishedCount = await getSurveyCount(
        result.workspaceId,
        {
          status: ["inProgress", "paused", "completed"],
          createdBy: { userId: ctx.user.id, value: ["you"] },
        },
        await resolveSurveyActorContext({ type: "user", id: ctx.user.id }, organizationId)
      );
      isSecondPublish = publishedCount === 2;
    }

    revalidatePath(`/workspaces/${result.workspaceId}/surveys/${result.id}`);

    return { ...result, isSecondPublish };
  })
);

const ZRefetchWorkspaceAction = z.object({
  workspaceId: z.cuid2(),
});

export const refetchWorkspaceAction = authenticatedActionClient
  .inputSchema(ZRefetchWorkspaceAction)
  .action(async ({ ctx, parsedInput }) => {
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: parsedInput.workspaceId,
    });

    return await getWorkspace(parsedInput.workspaceId);
  });

const ZGetWorkspaceLanguagesAction = z.object({
  workspaceId: ZId,
});

export const getWorkspaceLanguagesAction = authenticatedActionClient
  .inputSchema(ZGetWorkspaceLanguagesAction)
  .action(async ({ ctx, parsedInput }) => {
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.read", {
      type: "workspace",
      id: parsedInput.workspaceId,
    });

    return await getWorkspaceLanguages(parsedInput.workspaceId);
  });
