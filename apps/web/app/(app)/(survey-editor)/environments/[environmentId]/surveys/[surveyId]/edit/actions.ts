"use server";

import { TranslationServiceClient } from "@google-cloud/translate";
import { actionClient, authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromProjectId,
  getOrganizationIdFromSurveyId,
  getProjectIdFromEnvironmentId,
  getProjectIdFromSurveyId,
} from "@/lib/utils/helper";
import { getSurveyFollowUpsPermission } from "@/modules/ee/license-check/lib/utils";
import { checkMultiLanguagePermission } from "@/modules/ee/multi-language-surveys/lib/actions";
import { z } from "zod";
import { createActionClass } from "@formbricks/lib/actionClass/service";
import { UNSPLASH_ACCESS_KEY, UNSPLASH_ALLOWED_DOMAINS } from "@formbricks/lib/constants";
import { getOrganization } from "@formbricks/lib/organization/service";
import { getProject } from "@formbricks/lib/project/service";
import { updateSurvey } from "@formbricks/lib/survey/service";
import { ZActionClassInput } from "@formbricks/types/action-classes";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZSurvey } from "@formbricks/types/surveys/types";

/**
 * Checks if survey follow-ups are enabled for the given organization.
 *
 * @param { string } organizationId  The ID of the organization to check.
 * @returns { Promise<void> }  A promise that resolves if the permission is granted.
 * @throws { ResourceNotFoundError }  If the organization is not found.
 * @throws { OperationNotAllowedError }  If survey follow-ups are not enabled for the organization.
 */
const checkSurveyFollowUpsPermission = async (organizationId: string): Promise<void> => {
  const organization = await getOrganization(organizationId);
  if (!organization) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const isSurveyFollowUpsEnabled = await getSurveyFollowUpsPermission(organization);
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
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromSurveyId(parsedInput.id),
          minPermission: "readWrite",
        },
      ],
    });

    if (parsedInput.followUps?.length) {
      await checkSurveyFollowUpsPermission(organizationId);
    }

    if (parsedInput.languages?.length) {
      await checkMultiLanguagePermission(organizationId);
    }

    return await updateSurvey(parsedInput);
  });

const ZRefetchProjectAction = z.object({
  projectId: ZId,
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
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: parsedInput.projectId,
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
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.action.environmentId),
        },
      ],
    });

    return await createActionClass(parsedInput.action.environmentId, parsedInput.action);
  });

const service_key = process.env.GOOGLE_TRANSLATE_SERVICE_KEY;

if (!service_key) {
  throw new Error("Google Translate service key must be set in environment variables.");
}

const credential = JSON.parse(Buffer.from(service_key, "base64").toString());

const translationClient = new TranslationServiceClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: credential.client_email,
    private_key: credential.private_key,
  },
});

export async function translateText(
  targetLanguageCode: string,
  texts: { [key: string]: string }
): Promise<{ [key: string]: string }> {
  const keys = Object.keys(texts);
  const values = Object.values(texts);

  const request = {
    parent: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/global`,
    contents: values,
    mimeType: "text/plain",
    sourceLanguageCode: "en",
    targetLanguageCode: targetLanguageCode,
  };

  try {
    const [response] = await translationClient.translateText(request);
    if (response.translations) {
      const translatedTexts = response.translations.map(
        (translation) => translation.translatedText || "!!! TRANSLATION FAILED !!!"
      );
      const translatedDict: { [key: string]: string } = {};
      keys.forEach((key, index) => {
        translatedDict[key] = translatedTexts[index];
      });
      return translatedDict;
    } else {
      console.error("No translations found in the response.");
      return {};
    }
  } catch (error) {
    console.error("Error translating text:", error);
    throw error;
  }
}
