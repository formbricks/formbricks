"use server";

import { getOrganization } from "@/lib/organization/service";
import { loadNewSegmentInSurvey } from "@/lib/survey/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getEnvironmentIdFromSegmentId,
  getEnvironmentIdFromSurveyId,
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromSegmentId,
  getOrganizationIdFromSurveyId,
  getProjectIdFromEnvironmentId,
  getProjectIdFromSegmentId,
  getProjectIdFromSurveyId,
} from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
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
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZSegmentCreateInput, ZSegmentFilters, ZSegmentUpdateInput } from "@formbricks/types/segment";

const checkAdvancedTargetingPermission = async (organizationId: string) => {
  const organization = await getOrganization(organizationId);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const isContactsEnabled = await getIsContactsEnabled();

  if (!isContactsEnabled) {
    throw new OperationNotAllowedError("Advanced targeting is not allowed for this organization");
  }
};

export const createSegmentAction = authenticatedActionClient.schema(ZSegmentCreateInput).action(
  withAuditLogging("created", "segment", async ({ ctx, parsedInput }) => {
    if (parsedInput.surveyId) {
      const surveyEnvironmentId = await getEnvironmentIdFromSurveyId(parsedInput.surveyId);

      if (surveyEnvironmentId !== parsedInput.environmentId) {
        throw new Error("Survey and segment are not in the same environment");
      }
    }

    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);

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
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    await checkAdvancedTargetingPermission(organizationId);

    const parsedFilters = ZSegmentFilters.safeParse(parsedInput.filters);

    if (!parsedFilters.success) {
      const errMsg =
        parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message || "Invalid filters";
      throw new Error(errMsg);
    }

    const segment = await createSegment(parsedInput);

    // Set the segmentId in the context to be used in the audit log
    ctx.auditLoggingCtx.segmentId = segment.id;
    ctx.auditLoggingCtx.newObject = segment;

    return segment;
  })
);

const ZUpdateSegmentAction = z.object({
  environmentId: ZId,
  segmentId: ZId,
  data: ZSegmentUpdateInput,
});

export const updateSegmentAction = authenticatedActionClient
  .schema(ZUpdateSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromSegmentId(parsedInput.segmentId),
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
        throw new Error(errMsg);
      }

      await checkForRecursiveSegmentFilter(parsedFilters.data, parsedInput.segmentId);
    }

    return await updateSegment(parsedInput.segmentId, parsedInput.data);
  });

const ZLoadNewSegmentAction = z.object({
  surveyId: ZId,
  segmentId: ZId,
});

export const loadNewSegmentAction = authenticatedActionClient
  .schema(ZLoadNewSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    const surveyEnvironmentId = await getEnvironmentIdFromSurveyId(parsedInput.surveyId);
    const segmentEnvironmentId = await getEnvironmentIdFromSegmentId(parsedInput.segmentId);

    if (surveyEnvironmentId !== segmentEnvironmentId) {
      throw new Error("Segment and survey are not in the same environment");
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
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromEnvironmentId(surveyEnvironmentId),
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

export const cloneSegmentAction = authenticatedActionClient
  .schema(ZCloneSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    const surveyEnvironmentId = await getEnvironmentIdFromSurveyId(parsedInput.surveyId);
    const segmentEnvironmentId = await getEnvironmentIdFromSegmentId(parsedInput.segmentId);

    if (surveyEnvironmentId !== segmentEnvironmentId) {
      throw new Error("Segment and survey are not in the same environment");
    }

    // const organizationId = await getOrganizationIdFromEnvironmentId(surveyEnvironmentId);
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
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromEnvironmentId(surveyEnvironmentId),
        },
      ],
    });

    await checkAdvancedTargetingPermission(organizationId);

    return await cloneSegment(parsedInput.segmentId, parsedInput.surveyId);
  });

const ZDeleteSegmentAction = z.object({
  segmentId: ZId,
});

export const deleteSegmentAction = authenticatedActionClient.schema(ZDeleteSegmentAction).action(
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
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromSegmentId(parsedInput.segmentId),
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
  .schema(ZResetSegmentFiltersAction)
  .action(async ({ ctx, parsedInput }) => {
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
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    await checkAdvancedTargetingPermission(organizationId);

    return await resetSegmentInSurvey(parsedInput.surveyId);
  });
