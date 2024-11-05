"use server";

import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromSegmentId,
  getOrganizationIdFromSurveyId,
  getProductIdFromEnvironmentId,
  getProductIdFromSegmentId,
  getProductIdFromSurveyId,
} from "@/lib/utils/helper";
import { getSegment, getSurvey } from "@/lib/utils/services";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          rules: ["segment", "create"],
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
          rules: ["segment", "update"],
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
    const surveyEnvironment = await getSurvey(parsedInput.surveyId);
    const segmentEnvironment = await getSegment(parsedInput.segmentId);

    if (!surveyEnvironment || !segmentEnvironment) {
      if (!surveyEnvironment) {
        throw new Error("Survey not found");
      }
      if (!segmentEnvironment) {
        throw new Error("Segment not found");
      }
    }

    if (surveyEnvironment.environmentId !== segmentEnvironment.environmentId) {
      throw new Error("Segment and survey are not in the same environment");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          rules: ["survey", "update"],
        },
        {
          type: "productTeam",
          minPermission: "readWrite",
          productId: await getProductIdFromSurveyId(parsedInput.surveyId),
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
    const surveyEnvironment = await getSurvey(parsedInput.surveyId);
    const segmentEnvironment = await getSegment(parsedInput.segmentId);

    if (!surveyEnvironment || !segmentEnvironment) {
      if (!surveyEnvironment) {
        throw new Error("Survey not found");
      }
      if (!segmentEnvironment) {
        throw new Error("Segment not found");
      }
    }

    if (surveyEnvironment.environmentId !== segmentEnvironment.environmentId) {
      throw new Error("Segment and survey are not in the same environment");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          rules: ["segment", "create"],
        },
        {
          type: "productTeam",
          minPermission: "readWrite",
          productId: await getProductIdFromSurveyId(parsedInput.surveyId),
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
          rules: ["segment", "delete"],
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
          rules: ["survey", "update"],
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
