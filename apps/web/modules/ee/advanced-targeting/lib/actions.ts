"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getEnvironmentIdFromSegmentId,
  getEnvironmentIdFromSurveyId,
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromSegmentId,
  getOrganizationIdFromSurveyId,
  getProductIdFromEnvironmentId,
  getProductIdFromSegmentId,
  getProductIdFromSurveyId,
} from "@/lib/utils/helper";
import { z } from "zod";
import {
  cloneSegment,
  createSegment,
  deleteSegment,
  resetSegmentInSurvey,
  updateSegment,
} from "@formbricks/lib/segment/service";
import { loadNewSegmentInSurvey } from "@formbricks/lib/survey/service";
import { ZId } from "@formbricks/types/common";
import { ZSegmentCreateInput, ZSegmentFilters, ZSegmentUpdateInput } from "@formbricks/types/segment";

export const createSegmentAction = authenticatedActionClient
  .schema(ZSegmentCreateInput)
  .action(async ({ ctx, parsedInput }) => {
    const surveyEnvironmentId = await getEnvironmentIdFromSurveyId(parsedInput.surveyId);

    if (surveyEnvironmentId !== parsedInput.environmentId) {
      throw new Error("Survey and segment are not in the same environment");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "productTeam",
          minPermission: "readWrite",
          productId: await getProductIdFromEnvironmentId(parsedInput.environmentId),
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
  segmentId: ZId,
  data: ZSegmentUpdateInput,
});

export const updateSegmentAction = authenticatedActionClient
  .schema(ZUpdateSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSegmentId(parsedInput.segmentId),
      access: [
        {
          schema: ZSegmentUpdateInput,
          data: parsedInput.data,
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "productTeam",
          minPermission: "readWrite",
          productId: await getProductIdFromSegmentId(parsedInput.segmentId),
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
    const surveyEnvironmentId = await getEnvironmentIdFromSurveyId(parsedInput.surveyId);
    const segmentEnvironmentId = await getEnvironmentIdFromSegmentId(parsedInput.segmentId);

    if (surveyEnvironmentId !== segmentEnvironmentId) {
      throw new Error("Segment and survey are not in the same environment");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(surveyEnvironmentId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "productTeam",
          minPermission: "readWrite",
          productId: await getProductIdFromEnvironmentId(surveyEnvironmentId),
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
    const surveyEnvironmentId = await getEnvironmentIdFromSurveyId(parsedInput.surveyId);
    const segmentEnvironmentId = await getEnvironmentIdFromSegmentId(parsedInput.segmentId);

    if (surveyEnvironmentId !== segmentEnvironmentId) {
      throw new Error("Segment and survey are not in the same environment");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(surveyEnvironmentId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "productTeam",
          minPermission: "readWrite",
          productId: await getProductIdFromEnvironmentId(surveyEnvironmentId),
        },
      ],
    });

    return await cloneSegment(parsedInput.segmentId, parsedInput.surveyId);
  });

const ZDeleteSegmentAction = z.object({
  segmentId: ZId,
});

export const deleteSegmentAction = authenticatedActionClient
  .schema(ZDeleteSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSegmentId(parsedInput.segmentId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "productTeam",
          minPermission: "readWrite",
          productId: await getProductIdFromSegmentId(parsedInput.segmentId),
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
        {
          type: "productTeam",
          minPermission: "readWrite",
          productId: await getProductIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    return await resetSegmentInSurvey(parsedInput.surveyId);
  });
