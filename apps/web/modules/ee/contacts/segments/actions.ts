"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { InvalidInputError, OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZSegmentCreateInput, ZSegmentFilters, ZSegmentUpdateInput } from "@formbricks/types/segment";
import { getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { loadNewSegmentInSurvey } from "@/lib/survey/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getOrganizationIdFromSegmentId,
  getOrganizationIdFromSurveyId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromSegmentId,
  getWorkspaceIdFromSurveyId,
} from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getDistinctAttributeValues } from "@/modules/ee/contacts/lib/contact-attributes";
import { checkForRecursiveSegmentFilter } from "@/modules/ee/contacts/segments/lib/helper";
import {
  cloneSegment,
  createSegment,
  deleteSegment,
  getSegment,
  resetSegmentInSurvey,
  updateSegment,
} from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";

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

    await checkAuthorizationUpdated({
      userId: ctx.user?.id ?? "",
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "readWrite",
          workspaceId,
        },
      ],
    });

    await checkAdvancedTargetingPermission(organizationId);

    const parsedFilters = ZSegmentFilters.safeParse(parsedInput.filters);

    if (!parsedFilters.success) {
      const errMsg =
        parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message || "Invalid filters";
      throw new InvalidInputError(errMsg);
    }

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

const ZUpdateSegmentAction = z.object({
  segmentId: ZId,
  data: ZSegmentUpdateInput,
});

export const updateSegmentAction = authenticatedActionClient.inputSchema(ZUpdateSegmentAction).action(
  withAuditLogging("updated", "segment", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSegmentId(parsedInput.segmentId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "readWrite",
          workspaceId: await getWorkspaceIdFromSegmentId(parsedInput.segmentId),
        },
      ],
    });

    await checkAdvancedTargetingPermission(organizationId);

    const { filters } = parsedInput.data;
    if (filters) {
      const parsedFilters = ZSegmentFilters.safeParse(filters);

      if (!parsedFilters.success) {
        const errMsg =
          parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message || "Invalid filters";
        throw new InvalidInputError(errMsg);
      }

      await checkForRecursiveSegmentFilter(parsedFilters.data, parsedInput.segmentId);
    }

    const oldObject = await getSegment(parsedInput.segmentId);
    const updated = await updateSegment(parsedInput.segmentId, parsedInput.data);

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

export const loadNewSegmentAction = authenticatedActionClient
  .inputSchema(ZLoadNewSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    const surveyWorkspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);
    const segmentWorkspaceId = await getWorkspaceIdFromSegmentId(parsedInput.segmentId);

    if (surveyWorkspaceId !== segmentWorkspaceId) {
      throw new InvalidInputError("Segment and survey are not in the same workspace");
    }

    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "readWrite",
          workspaceId: surveyWorkspaceId,
        },
      ],
    });

    await checkAdvancedTargetingPermission(organizationId);

    return await loadNewSegmentInSurvey(parsedInput.surveyId, parsedInput.segmentId);
  });

const ZCloneSegmentAction = z.object({
  segmentId: ZId,
  surveyId: ZId,
});

export const cloneSegmentAction = authenticatedActionClient.inputSchema(ZCloneSegmentAction).action(
  withAuditLogging("created", "segment", async ({ ctx, parsedInput }) => {
    const surveyWorkspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);
    const segmentWorkspaceId = await getWorkspaceIdFromSegmentId(parsedInput.segmentId);

    if (surveyWorkspaceId !== segmentWorkspaceId) {
      throw new Error("Segment and survey are not in the same workspace");
    }

    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "readWrite",
          workspaceId: surveyWorkspaceId,
        },
      ],
    });

    await checkAdvancedTargetingPermission(organizationId);

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.segmentId = parsedInput.segmentId;

    const result = await cloneSegment(parsedInput.segmentId, parsedInput.surveyId);
    ctx.auditLoggingCtx.newObject = result;
    return result;
  })
);

const ZDeleteSegmentAction = z.object({
  segmentId: ZId,
});

export const deleteSegmentAction = authenticatedActionClient.inputSchema(ZDeleteSegmentAction).action(
  withAuditLogging("deleted", "segment", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSegmentId(parsedInput.segmentId);

    await checkAuthorizationUpdated({
      userId: ctx.user?.id ?? "",
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "readWrite",
          workspaceId: await getWorkspaceIdFromSegmentId(parsedInput.segmentId),
        },
      ],
    });

    await checkAdvancedTargetingPermission(organizationId);

    ctx.auditLoggingCtx.segmentId = parsedInput.segmentId;
    ctx.auditLoggingCtx.oldObject = await getSegment(parsedInput.segmentId);
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

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId: await getWorkspaceIdFromSurveyId(parsedInput.surveyId),
          },
        ],
      });

      await checkAdvancedTargetingPermission(organizationId);

      ctx.auditLoggingCtx.organizationId = organizationId;

      const result = await resetSegmentInSurvey(parsedInput.surveyId);

      ctx.auditLoggingCtx.newObject = result;
      ctx.auditLoggingCtx.segmentId = result.id;

      return result;
    })
  );

const ZGetDistinctAttributeValuesAction = z.object({
  workspaceId: ZId,
  attributeKeyId: ZId,
});

export const getDistinctAttributeValuesAction = authenticatedActionClient
  .inputSchema(ZGetDistinctAttributeValuesAction)
  .action(async ({ ctx, parsedInput }) => {
    const workspaceId = parsedInput.workspaceId;
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromWorkspaceId(workspaceId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "read",
          workspaceId,
        },
      ],
    });

    return await getDistinctAttributeValues(parsedInput.attributeKeyId);
  });
