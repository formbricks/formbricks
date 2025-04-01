"use server";

import { actionClient, authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromProjectId,
  getOrganizationIdFromSurveyId,
} from "@/lib/utils/helper";
import { createActionClass } from "@/modules/survey/editor/lib/action-class";
import { updateSurvey } from "@/modules/survey/editor/lib/survey";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";
import { z } from "zod";
import { UNSPLASH_ACCESS_KEY, UNSPLASH_ALLOWED_DOMAINS } from "@formbricks/lib/constants";
import { ZActionClassInput } from "@formbricks/types/action-classes";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZSurvey } from "@formbricks/types/surveys/types";
import { getProject } from "./lib/project";

/**
 * Checks if survey follow-ups are enabled for the given organization.
 *
 * @param { string } organizationId  The ID of the organization to check.
 * @returns { Promise<void> }  A promise that resolves if the permission is granted.
 * @throws { ResourceNotFoundError }  If the organization is not found.
 * @throws { OperationNotAllowedError }  If survey follow-ups are not enabled for the organization.
 */
const checkSurveyFollowUpsPermission = async (organizationId: string): Promise<void> => {
  const organizationBilling = await getOrganizationBilling(organizationId);
  if (!organizationBilling) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const isSurveyFollowUpsEnabled = await getSurveyFollowUpsPermission(organizationBilling.plan);
  if (!isSurveyFollowUpsEnabled) {
    throw new OperationNotAllowedError("Survey follow ups are not enabled for this organization");
  }
};

export const updateSurveyAction = authenticatedActionClient
  .schema(ZSurvey)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.id);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner"],
        },
      ],
    });

    if (parsedInput.followUps?.length) {
      await checkSurveyFollowUpsPermission(organizationId);
    }

    return await updateSurvey(parsedInput);
  });

const ZRefetchProjectAction = z.object({
  projectId: z.string().cuid2(),
});

export const refetchProjectAction = authenticatedActionClient
  .schema(ZRefetchProjectAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProjectId(parsedInput.projectId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await getProject(parsedInput.projectId);
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.action.environmentId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await createActionClass(parsedInput.action.environmentId, parsedInput.action);
  });
