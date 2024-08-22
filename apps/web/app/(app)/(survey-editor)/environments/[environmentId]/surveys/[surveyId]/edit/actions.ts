"use server";

import { z } from "zod";
import { createActionClass } from "@formbricks/lib/actionClass/service";
import { actionClient, authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { UNSPLASH_ACCESS_KEY } from "@formbricks/lib/constants";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromProductId,
  getOrganizationIdFromSegmentId,
  getOrganizationIdFromSurveyId,
} from "@formbricks/lib/organization/utils";
import { getProduct } from "@formbricks/lib/product/service";
import {
  cloneSegment,
  createSegment,
  resetSegmentInSurvey,
  updateSegment,
} from "@formbricks/lib/segment/service";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { loadNewSegmentInSurvey, updateSurvey } from "@formbricks/lib/survey/service";
import { ZActionClassInput } from "@formbricks/types/action-classes";
import { ZId } from "@formbricks/types/common";
import { ZBaseFilters, ZSegmentFilters, ZSegmentUpdateInput } from "@formbricks/types/segment";
import { ZSurvey } from "@formbricks/types/surveys/types";

export const updateSurveyAction = authenticatedActionClient
  .schema(ZSurvey)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.id),
      rules: ["survey", "update"],
    });
    return await updateSurvey(parsedInput);
  });

const ZRefetchProductAction = z.object({
  productId: ZId,
});

export const refetchProductAction = authenticatedActionClient
  .schema(ZRefetchProductAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProductId(parsedInput.productId),
      rules: ["product", "read"],
    });

    return await getProduct(parsedInput.productId);
  });

const ZCreateBasicSegmentAction = z.object({
  description: z.string().optional(),
  environmentId: ZId,
  filters: ZBaseFilters,
  isPrivate: z.boolean(),
  surveyId: ZId,
  title: z.string(),
});

export const createBasicSegmentAction = authenticatedActionClient
  .schema(ZCreateBasicSegmentAction)
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

    const segment = await createSegment({
      environmentId: parsedInput.environmentId,
      surveyId: parsedInput.surveyId,
      title: parsedInput.title,
      description: parsedInput.description || "",
      isPrivate: parsedInput.isPrivate,
      filters: parsedInput.filters,
    });
    surveyCache.revalidate({ id: parsedInput.surveyId });

    return segment;
  });

const ZUpdateBasicSegmentAction = z.object({
  segmentId: ZId,
  data: ZSegmentUpdateInput,
});

export const updateBasicSegmentAction = authenticatedActionClient
  .schema(ZUpdateBasicSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
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

const ZLoadNewBasicSegmentAction = z.object({
  surveyId: ZId,
  segmentId: ZId,
});

export const loadNewBasicSegmentAction = authenticatedActionClient
  .schema(ZLoadNewBasicSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSegmentId(parsedInput.surveyId),
      rules: ["segment", "read"],
    });

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["survey", "update"],
    });

    return await loadNewSegmentInSurvey(parsedInput.surveyId, parsedInput.segmentId);
  });

const ZCloneBasicSegmentAction = z.object({
  segmentId: ZId,
  surveyId: ZId,
});

export const cloneBasicSegmentAction = authenticatedActionClient
  .schema(ZCloneBasicSegmentAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSegmentId(parsedInput.segmentId),
      rules: ["segment", "create"],
    });

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["survey", "read"],
    });

    return await cloneSegment(parsedInput.segmentId, parsedInput.surveyId);
  });

const ZResetBasicSegmentFiltersAction = z.object({
  surveyId: ZId,
});

export const resetBasicSegmentFiltersAction = authenticatedActionClient
  .schema(ZResetBasicSegmentFiltersAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["segment", "update"],
    });

    return await resetSegmentInSurvey(parsedInput.surveyId);
  });

const ZGetImagesFromUnsplashAction = z.object({
  searchQuery: z.string(),
  page: z.number().optional(),
});

export const getImagesFromUnsplashAction = actionClient
  .schema(ZGetImagesFromUnsplashAction)
  .action(async ({ parsedInput }) => {
    if (!UNSPLASH_ACCESS_KEY) {
      throw new Error("Unsplash access key is not set");
    }
    const baseUrl = "https://api.unsplash.com/search/photos";
    const params = new URLSearchParams({
      query: parsedInput.searchQuery,
      client_id: UNSPLASH_ACCESS_KEY,
      orientation: "landscape",
      per_page: "9",
      page: (parsedInput.page || 1).toString(),
    });

    const response = await fetch(`${baseUrl}?${params}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch images from Unsplash");
    }

    const { results } = await response.json();
    return results.map((result) => {
      const authorName = encodeURIComponent(result.user.first_name + " " + result.user.last_name);
      const authorLink = encodeURIComponent(result.user.links.html);

      return {
        id: result.id,
        alt_description: result.alt_description,
        urls: {
          regularWithAttribution: `${result.urls.regular}&dpr=2&authorLink=${authorLink}&authorName=${authorName}&utm_source=formbricks&utm_medium=referral`,
          download: result.links.download_location,
        },
      };
    });
  });

const ZTriggerDownloadUnsplashImageAction = z.object({
  downloadUrl: z.string(),
});

export const triggerDownloadUnsplashImageAction = actionClient
  .schema(ZTriggerDownloadUnsplashImageAction)
  .action(async ({ parsedInput }) => {
    const response = await fetch(`${parsedInput.downloadUrl}/?client_id=${UNSPLASH_ACCESS_KEY}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to download image from Unsplash");
    }

    return;
  });

const ZCreateActionClassAction = z.object({
  action: ZActionClassInput,
});

export const createActionClassAction = authenticatedActionClient
  .schema(ZCreateActionClassAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.action.environmentId),
      rules: ["actionClass", "create"],
    });

    return await createActionClass(parsedInput.action.environmentId, parsedInput.action);
  });
