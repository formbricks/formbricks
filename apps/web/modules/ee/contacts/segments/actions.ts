"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { InvalidInputError, OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  type TBaseFilters,
  ZSegmentCreateInput,
  ZSegmentFilters,
  ZSegmentSurveyIds,
  ZSegmentUpdateInput,
} from "@formbricks/types/segment";
import { assertCan } from "@/lib/authorization";
import { getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { loadNewSegmentInSurvey } from "@/lib/survey/service";
import { getUserVisibleSurveyWhere, resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import {
  getOrganizationIdFromSurveyId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromSurveyId,
} from "@/lib/utils/helper";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getDistinctAttributeValues } from "@/modules/ee/contacts/lib/contact-attributes";
import { requireWorkspaceContactDirectory } from "@/modules/ee/contacts/lib/contact-directory";
import {
  assertAddedSegmentSurveyFiltersVisible,
  assertAddedSurveyInteractionSurveyIds,
  assertNewSegmentSurveyInteractionSurveyIds,
  assertSegmentSurveyFiltersVisible,
  assertSurveysInWorkspace,
  checkForRecursiveSegmentFilter,
  restoreHiddenSegmentSurveyIds,
} from "@/modules/ee/contacts/segments/lib/helper";
import {
  cloneSegment,
  createSegment,
  deleteSegment,
  getOtherWorkspaceSurveyIds,
  getSegmentInWorkspace,
  getSurveyRefsForWorkspace,
  getSurveyWorkspaceIdMap,
  resetSegmentInSurvey,
  updateSegment,
} from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";

/**
 * ENG-3282: a segment targets surveys by id, and its survey-interaction filters read who answered them —
 * so every survey a mutation references needs `survey.write`, not just the workspace's. A single survey
 * is checked directly; an array goes through `assertSurveysInWorkspace`, one batched query with the
 * caller's visibility predicate (equivalent to `survey.write` once `workspace.write` has passed).
 */
const assertCanWriteSurvey = (userId: string, surveyId: string) =>
  assertCan({ type: "user", id: userId }, "survey.write", { type: "survey", id: surveyId });

/**
 * ENG-6870: attaching or copying a segment onto a survey targets that survey at whoever the segment's
 * survey-interaction filters match, and the survey's responses then show who they are. So the caller must
 * see every survey those filters read, as if they had written them. `workspaceId` is the survey's.
 */
const assertCanTargetWithSegment = async (
  userId: string,
  organizationId: string,
  segment: { id: string; filters: TBaseFilters },
  workspaceId: string
) => {
  await assertSegmentSurveyFiltersVisible(
    segment.filters,
    workspaceId,
    await resolveSurveyActorContext({ type: "user", id: userId }, organizationId),
    segment.id
  );
};

const checkAdvancedTargetingPermission = async (organizationId: string) => {
  const organization = await getOrganization(organizationId);

  if (!organization) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const isContactsEnabled = await getIsContactsEnabled(organizationId);

  if (!isContactsEnabled) {
    throw new OperationNotAllowedError("Advanced targeting is not allowed for this organization");
  }
};

export const createSegmentAction = authenticatedActionClient.inputSchema(ZSegmentCreateInput).action(
  withAuditLogging("created", "segment", async ({ ctx, parsedInput }) => {
    if (parsedInput.surveyId) {
      const surveyWorkspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);

      if (surveyWorkspaceId !== parsedInput.workspaceId) {
        throw new InvalidInputError("Survey and segment are not in the same workspace");
      }
    }

    const workspaceId = parsedInput.workspaceId;
    const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

    // Set the organizationId in the context to be used in the audit log
    ctx.auditLoggingCtx.organizationId = organizationId;

    await assertCan({ type: "user", id: ctx.user?.id ?? "" }, "workspace.write", {
      type: "workspace",
      id: workspaceId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, workspaceId);

    await checkAdvancedTargetingPermission(organizationId);

    const parsedFilters = ZSegmentFilters.safeParse(parsedInput.filters);

    if (!parsedFilters.success) {
      const errMsg =
        parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message || "Invalid filters";
      throw new InvalidInputError(errMsg);
    }

    const userId = ctx.user?.id ?? "";
    if (parsedInput.surveyId) await assertCanWriteSurvey(userId, parsedInput.surveyId);
    // As for an edit, a survey id copied from a segment the workspace reaches may name another workspace's
    // survey on the directory ("Save as new segment"); every other id must be the caller's to see.
    await assertNewSegmentSurveyInteractionSurveyIds(
      parsedFilters.data,
      workspaceId,
      await getUserVisibleSurveyWhere(userId, organizationId)
    );
    // ENG-6870: and the surveys nested segment filters read.
    await assertSegmentSurveyFiltersVisible(
      parsedFilters.data,
      workspaceId,
      await resolveSurveyActorContext({ type: "user", id: userId }, organizationId)
    );

    const segment = await createSegment(parsedInput);

    // Set the segmentId in the context to be used in the audit log
    ctx.auditLoggingCtx.segmentId = segment.id;
    ctx.auditLoggingCtx.newObject = segment;

    capturePostHogEvent(
      ctx.user?.id ?? "",
      "segment_created",
      {
        organization_id: organizationId,
        workspace_id: workspaceId,
        is_private: parsedInput.isPrivate ?? false,
      },
      { organizationId, workspaceId }
    );

    return segment;
  })
);

// A segment belongs to its contact directory and every workspace on it may use it (decision 24), so the
// caller names the workspace they act from; the segment's own `workspaceId` is only where it was made.
const ZUpdateSegmentAction = z.object({
  segmentId: ZId,
  workspaceId: ZId,
  data: ZSegmentUpdateInput,
});

export const updateSegmentAction = authenticatedActionClient.inputSchema(ZUpdateSegmentAction).action(
  withAuditLogging("updated", "segment", async ({ ctx, parsedInput }) => {
    const { workspaceId } = parsedInput;
    const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: workspaceId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, workspaceId);

    await checkAdvancedTargetingPermission(organizationId);

    const oldObject = await getSegmentInWorkspace(parsedInput.segmentId, workspaceId);

    // ENG-1920: the surveys are connected to the segment by id alone, so a survey it is not on yet must
    // belong to the caller's workspace — otherwise a caller could re-point another tenant's survey to
    // their segment, or a survey of another workspace on the directory they cannot write. A single
    // batched lookup avoids fanning out a query per survey id over the caller-controlled array; an
    // unknown id is absent from the map and thus rejected.
    const connectedSurveyIds = new Set(oldObject.surveys);
    const addedSurveyIds = (parsedInput.data.surveys ?? []).filter(
      (surveyId) => !connectedSurveyIds.has(surveyId)
    );
    if (addedSurveyIds.length > 0) {
      const surveyWorkspaceIdMap = await getSurveyWorkspaceIdMap(addedSurveyIds);
      const allInWorkspace = addedSurveyIds.every(
        (surveyId) => surveyWorkspaceIdMap.get(surveyId) === workspaceId
      );
      if (!allInWorkspace) {
        throw new InvalidInputError("Survey and segment are not in the same workspace");
      }
    }
    const visibleSurveyWhere = await getUserVisibleSurveyWhere(ctx.user.id, organizationId);
    if (addedSurveyIds.length > 0 && Object.keys(visibleSurveyWhere).length > 0) {
      await assertSurveysInWorkspace(addedSurveyIds, workspaceId, visibleSurveyWhere);
    }

    const actor = await resolveSurveyActorContext({ type: "user", id: ctx.user.id }, organizationId);
    let data = parsedInput.data;
    const { filters } = parsedInput.data;
    if (filters) {
      // Only the ids the caller added must be surveys of their workspace they can see; the stored ones
      // stay (a shared segment can name another workspace's survey), and the stored ones they could not
      // see are put back afterwards, since the editor never held them.
      await assertAddedSurveyInteractionSurveyIds(
        filters,
        oldObject.filters,
        workspaceId,
        visibleSurveyWhere
      );
      // ENG-6870: and the surveys nested segment filters read, where the edit adds them.
      await assertAddedSegmentSurveyFiltersVisible(
        filters,
        oldObject.filters,
        workspaceId,
        actor,
        parsedInput.segmentId
      );
      const merged =
        Object.keys(visibleSurveyWhere).length > 0
          ? await restoreHiddenSegmentSurveyIds(filters, oldObject.filters, workspaceId, visibleSurveyWhere)
          : filters;

      // The merged tree is what gets stored, so it is the one held to the bounds (at most 100 surveys
      // per filter, and so on).
      const parsedFilters = ZSegmentFilters.safeParse(merged);
      if (!parsedFilters.success) {
        const errMsg =
          parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message || "Invalid filters";
        throw new InvalidInputError(errMsg);
      }

      await checkForRecursiveSegmentFilter(parsedFilters.data, parsedInput.segmentId);
      data = { ...parsedInput.data, filters: parsedFilters.data };
    }

    // ENG-6870: connecting a survey to the segment targets it with the whole tree, as attaching one
    // does (`assertCanTargetWithSegment`), so every survey the stored tree reads must be visible too.
    if (addedSurveyIds.length > 0) {
      await assertSegmentSurveyFiltersVisible(
        data.filters ?? oldObject.filters,
        workspaceId,
        actor,
        parsedInput.segmentId
      );
    }

    const updated = await updateSegment(parsedInput.segmentId, data);

    ctx.auditLoggingCtx.segmentId = parsedInput.segmentId;
    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.oldObject = oldObject;
    ctx.auditLoggingCtx.newObject = updated;

    return updated;
  })
);

const ZLoadNewSegmentAction = z.object({
  surveyId: ZId,
  segmentId: ZId,
});

export const loadNewSegmentAction = authenticatedActionClient.inputSchema(ZLoadNewSegmentAction).action(
  withAuditLogging("updated", "survey", async ({ ctx, parsedInput }) => {
    const surveyWorkspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: surveyWorkspaceId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, surveyWorkspaceId);

    await checkAdvancedTargetingPermission(organizationId);
    await assertCanWriteSurvey(ctx.user.id, parsedInput.surveyId);
    // The survey may use any segment of its workspace's directory (decision 24).
    const segment = await getSegmentInWorkspace(parsedInput.segmentId, surveyWorkspaceId);
    await assertCanTargetWithSegment(ctx.user.id, organizationId, segment, surveyWorkspaceId);

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.surveyId = parsedInput.surveyId;
    const result = await loadNewSegmentInSurvey(parsedInput.surveyId, parsedInput.segmentId);
    ctx.auditLoggingCtx.newObject = result;
    return result;
  })
);

const ZCloneSegmentAction = z.object({
  segmentId: ZId,
  surveyId: ZId,
});

export const cloneSegmentAction = authenticatedActionClient.inputSchema(ZCloneSegmentAction).action(
  withAuditLogging("created", "segment", async ({ ctx, parsedInput }) => {
    const surveyWorkspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);

    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: surveyWorkspaceId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, surveyWorkspaceId);

    await checkAdvancedTargetingPermission(organizationId);
    await assertCanWriteSurvey(ctx.user.id, parsedInput.surveyId);
    // The survey may copy any segment of its workspace's directory (decision 24).
    const segment = await getSegmentInWorkspace(parsedInput.segmentId, surveyWorkspaceId);
    await assertCanTargetWithSegment(ctx.user.id, organizationId, segment, surveyWorkspaceId);

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.segmentId = parsedInput.segmentId;

    const result = await cloneSegment(parsedInput.segmentId, parsedInput.surveyId, surveyWorkspaceId);
    ctx.auditLoggingCtx.newObject = result;
    return result;
  })
);

const ZDeleteSegmentAction = z.object({
  segmentId: ZId,
  workspaceId: ZId,
});

export const deleteSegmentAction = authenticatedActionClient.inputSchema(ZDeleteSegmentAction).action(
  withAuditLogging("deleted", "segment", async ({ ctx, parsedInput }) => {
    const { workspaceId } = parsedInput;
    const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

    await assertCan({ type: "user", id: ctx.user?.id ?? "" }, "workspace.write", {
      type: "workspace",
      id: workspaceId,
    });
    await applyRateLimit(rateLimitConfigs.actions.stateMutation, workspaceId);

    await checkAdvancedTargetingPermission(organizationId);

    ctx.auditLoggingCtx.segmentId = parsedInput.segmentId;
    ctx.auditLoggingCtx.oldObject = await getSegmentInWorkspace(parsedInput.segmentId, workspaceId);
    ctx.auditLoggingCtx.organizationId = organizationId;

    return await deleteSegment(parsedInput.segmentId);
  })
);

const ZResetSegmentFiltersAction = z.object({
  surveyId: ZId,
});

export const resetSegmentFiltersAction = authenticatedActionClient
  .inputSchema(ZResetSegmentFiltersAction)
  .action(
    withAuditLogging("updated", "segment", async ({ ctx, parsedInput }) => {
      const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
      const workspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);

      await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
        type: "workspace",
        id: workspaceId,
      });
      await applyRateLimit(rateLimitConfigs.actions.stateMutation, workspaceId);

      await checkAdvancedTargetingPermission(organizationId);
      await assertCanWriteSurvey(ctx.user.id, parsedInput.surveyId);

      ctx.auditLoggingCtx.organizationId = organizationId;

      const result = await resetSegmentInSurvey(parsedInput.surveyId);

      ctx.auditLoggingCtx.newObject = result;
      ctx.auditLoggingCtx.segmentId = result.id;

      return result;
    })
  );

// A key belongs to the directory and records only the workspace it was made from (none for a directory's
// default keys), so the caller names the workspace they act from.
const ZGetDistinctAttributeValuesAction = z.object({
  attributeKeyId: ZId,
  workspaceId: ZId,
});

export const getDistinctAttributeValuesAction = authenticatedActionClient
  .inputSchema(ZGetDistinctAttributeValuesAction)
  .action(async ({ ctx, parsedInput }) => {
    const { workspaceId } = parsedInput;
    const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

    await assertCan({ type: "user", id: ctx.user.id }, "workspace.read", {
      type: "workspace",
      id: workspaceId,
    });

    await checkAdvancedTargetingPermission(organizationId);

    const directory = await requireWorkspaceContactDirectory(workspaceId);
    return await getDistinctAttributeValues(parsedInput.attributeKeyId, directory.id);
  });

const ZGetSurveysForSegmentFilterAction = z.object({
  workspaceId: ZId,
  // The ids a filter names that are not among the workspace's surveys: the ones of another workspace on
  // the directory come back so the picker can show them (decision 24).
  surveyIds: ZSegmentSurveyIds.optional(),
});

export const getSurveysForSegmentFilterAction = authenticatedActionClient
  .inputSchema(ZGetSurveysForSegmentFilterAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);

    await assertCan({ type: "user", id: ctx.user.id }, "workspace.read", {
      type: "workspace",
      id: parsedInput.workspaceId,
    });

    await checkAdvancedTargetingPermission(organizationId);

    const [surveys, otherWorkspaceSurveyIds] = await Promise.all([
      getSurveyRefsForWorkspace(
        parsedInput.workspaceId,
        await getUserVisibleSurveyWhere(ctx.user.id, organizationId)
      ),
      getOtherWorkspaceSurveyIds(parsedInput.workspaceId, parsedInput.surveyIds ?? []),
    ]);
    return { surveys, otherWorkspaceSurveyIds };
  });
