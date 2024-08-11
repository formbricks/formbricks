"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromSegmentId,
  getOrganizationIdFromSurveyId,
} from "@formbricks/lib/organization/utils";
import {
  cloneSegment,
  createSegment,
  deleteSegment,
  resetSegmentInSurvey,
  updateSegment,
} from "@formbricks/lib/segment/service";
import { loadNewSegmentInSurvey } from "@formbricks/lib/survey/service";
import { ZSegmentCreateInput, ZSegmentFilters } from "@formbricks/types/segment";

export const createSegmentAction = authenticatedActionClient
  .schema(ZSegmentCreateInput)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["segment", "create"],
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
  environmentId: z.string(),
  segmentId: z.string(),
  data: ZSegmentCreateInput,
});

export const updateSegmentAction = authenticatedActionClient
  .schema(ZUpdateSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      data: parsedInput.data,
      schema: ZSegmentCreateInput,
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.data.environmentId),
      rules: ["segment", "update"],
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
  surveyId: z.string(),
  segmentId: z.string(),
});

export const loadNewSegmentAction = authenticatedActionClient
  .schema(ZLoadNewSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["survey", "update"],
    });

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSegmentId(parsedInput.segmentId),
      rules: ["segment", "read"],
    });

    return await loadNewSegmentInSurvey(parsedInput.surveyId, parsedInput.segmentId);
  });

const ZCloneSegmentAction = z.object({
  segmentId: z.string(),
  surveyId: z.string(),
});

export const cloneSegmentAction = authenticatedActionClient
  .schema(ZCloneSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["segment", "create"],
    });

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSegmentId(parsedInput.segmentId),
      rules: ["segment", "create"],
    });

    return await cloneSegment(parsedInput.segmentId, parsedInput.surveyId);
  });

const ZDeleteSegmentAction = z.object({
  segmentId: z.string(),
});

export const deleteSegmentAction = authenticatedActionClient
  .schema(ZDeleteSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSegmentId(parsedInput.segmentId),
      rules: ["segment", "delete"],
    });

    return await deleteSegment(parsedInput.segmentId);
  });

const ZResetSegmentFiltersAction = z.object({
  surveyId: z.string(),
});

export const resetSegmentFiltersAction = authenticatedActionClient
  .schema(ZResetSegmentFiltersAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["survey", "update"],
    });

    return await resetSegmentInSurvey(parsedInput.surveyId);
  });
