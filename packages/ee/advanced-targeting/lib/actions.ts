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
import { ZId } from "@formbricks/types/common";
import { ZSegmentCreateInput, ZSegmentFilters, ZSegmentUpdateInput } from "@formbricks/types/segment";

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
  segmentId: ZId,
  data: ZSegmentUpdateInput,
});

export const updateSegmentAction = authenticatedActionClient
  .schema(ZUpdateSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      data: parsedInput.data,
      schema: ZSegmentUpdateInput,
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSegmentId(parsedInput.segmentId),
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
  surveyId: ZId,
  segmentId: ZId,
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
  segmentId: ZId,
  surveyId: ZId,
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
  segmentId: ZId,
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
  surveyId: ZId,
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
