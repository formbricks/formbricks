"use server";

import { z } from "zod";
import { createActionClass } from "@formbricks/lib/actionClass/service";
import { actionClient, authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { UNSPLASH_ACCESS_KEY, UNSPLASH_ALLOWED_DOMAINS } from "@formbricks/lib/constants";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromProductId,
  getOrganizationIdFromSurveyId,
} from "@formbricks/lib/organization/utils";
import { getProduct } from "@formbricks/lib/product/service";
import { updateSurvey } from "@formbricks/lib/survey/service";
import { ZActionClassInput } from "@formbricks/types/action-classes";
import { ZId } from "@formbricks/types/common";
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

const isValidUnsplashUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "https:" && UNSPLASH_ALLOWED_DOMAINS.includes(parsedUrl.hostname);
  } catch {
    return false;
  }
};

const ZTriggerDownloadUnsplashImageAction = z.object({
  downloadUrl: z.string().url(),
});

export const triggerDownloadUnsplashImageAction = actionClient
  .schema(ZTriggerDownloadUnsplashImageAction)
  .action(async ({ parsedInput }) => {
    if (!isValidUnsplashUrl(parsedInput.downloadUrl)) {
      throw new Error("Invalid Unsplash URL");
    }

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
