"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getOrganizationIdFromSurveyId } from "@/lib/utils/helper";
import {
  cloneSegment,
  createSegment,
  deleteSegment,
  resetSegmentInSurvey,
  updateSegment,
} from "@/modules/ee/contacts/segments/lib/segments";
import { z } from "zod";
import { loadNewSegmentInSurvey } from "@formbricks/lib/survey/service";
import { ZId } from "@formbricks/types/common";
import { ZSegmentCreateInput, ZSegmentFilters, ZSegmentUpdateInput } from "@formbricks/types/segment";

export const createSegmentAction = authenticatedActionClient
  .schema(ZSegmentCreateInput)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    const parsedFilters = ZSegmentFilters.safeParse(parsedInput.filters);

    if (!parsedFilters.success) {
      const errMsg =
        parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message || "Invalid filters";
      throw new Error(errMsg);
    }

    return await createSegment(parsedInput);
  });

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
      ],
    });

    const { filters } = parsedInput.data;
    if (filters) {
      const parsedFilters = ZSegmentFilters.safeParse(filters);

      if (!parsedFilters.success) {
        const errMsg =
          parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message || "Invalid filters";
        throw new Error(errMsg);
      }
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await loadNewSegmentInSurvey(parsedInput.surveyId, parsedInput.segmentId);
  });

const ZCloneSegmentAction = z.object({
  segmentId: ZId,
  surveyId: ZId,
});

export const cloneSegmentAction = authenticatedActionClient
  .schema(ZCloneSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await cloneSegment(parsedInput.segmentId, parsedInput.surveyId);
  });

const ZDeleteSegmentAction = z.object({
  environmentId: ZId,
  segmentId: ZId,
});

export const deleteSegmentAction = authenticatedActionClient
  .schema(ZDeleteSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await deleteSegment(parsedInput.segmentId);
  });

const ZResetSegmentFiltersAction = z.object({
  surveyId: ZId,
});

export const resetSegmentFiltersAction = authenticatedActionClient
  .schema(ZResetSegmentFiltersAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await resetSegmentInSurvey(parsedInput.surveyId);
  });
