"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ZActionClassInput } from "@formbricks/types/action-classes";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey, ZSurvey } from "@formbricks/types/surveys/types";
import { UNSPLASH_ACCESS_KEY, UNSPLASH_ALLOWED_DOMAINS } from "@/lib/constants";
import { actionClient, authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import {
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromProjectId,
  getOrganizationIdFromSurveyId,
  getProjectIdFromEnvironmentId,
  getProjectIdFromSurveyId,
} from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { createActionClass } from "@/modules/survey/editor/lib/action-class";
import { checkExternalUrlsPermission } from "@/modules/survey/editor/lib/check-external-urls-permission";
import { updateSurvey, updateSurveyDraft } from "@/modules/survey/editor/lib/survey";
import { ZSurveyDraft } from "@/modules/survey/editor/types/survey";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { checkSpamProtectionPermission } from "@/modules/survey/lib/permission";
import { getOrganizationBilling, getSurvey } from "@/modules/survey/lib/survey";
import { getProject } from "./lib/project";

/**
 * Checks if survey follow-ups can be added for the given organization.
 * Grandfathers existing follow-ups (allows keeping them even if the org lost access).
 * Only throws when new follow-ups are being added.
 */
const checkSurveyFollowUpsPermission = async (
  organizationId: string,
  newFollowUpIds: string[],
  oldFollowUpIds: Set<string>
): Promise<void> => {
  const organizationBilling = await getOrganizationBilling(organizationId);
  if (!organizationBilling) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const isSurveyFollowUpsEnabled = await getSurveyFollowUpsPermission(organizationId);
  if (isSurveyFollowUpsEnabled) return;

  for (const id of newFollowUpIds) {
    if (!oldFollowUpIds.has(id)) {
      throw new OperationNotAllowedError("Survey follow ups are not enabled for this organization");
    }
  }
};

export const updateSurveyDraftAction = authenticatedActionClient.inputSchema(ZSurveyDraft).action(
  withAuditLogging("updated", "survey", async ({ ctx, parsedInput }) => {
    // Cast to TSurvey - ZSurveyDraft validates structure, full validation happens on publish
    const survey = parsedInput as TSurvey;

    const organizationId = await getOrganizationIdFromSurveyId(survey.id);
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
          projectId: await getProjectIdFromSurveyId(survey.id),
          minPermission: "readWrite",
        },
      ],
    });

    if (survey.recaptcha?.enabled) {
      await checkSpamProtectionPermission(organizationId);
    }

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.surveyId = survey.id;
    const oldObject = await getSurvey(survey.id);

    if (survey.followUps.length) {
      const oldFollowUpIds = new Set((oldObject?.followUps ?? []).map((f) => f.id));
      await checkSurveyFollowUpsPermission(
        organizationId,
        survey.followUps.map((f) => f.id),
        oldFollowUpIds
      );
    }

    await checkExternalUrlsPermission(organizationId, survey, oldObject);

    // Use the draft version that skips validation
    const result = await updateSurveyDraft(survey);

    ctx.auditLoggingCtx.oldObject = oldObject;
    ctx.auditLoggingCtx.newObject = result;

    revalidatePath(`/environments/${result.environmentId}/surveys/${result.id}`);

    return result;
  })
);

export const updateSurveyAction = authenticatedActionClient.inputSchema(ZSurvey).action(
  withAuditLogging("updated", "survey", async ({ ctx, parsedInput }) => {
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

    if (parsedInput.recaptcha?.enabled) {
      await checkSpamProtectionPermission(organizationId);
    }

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.surveyId = parsedInput.id;
    const oldObject = await getSurvey(parsedInput.id);

    if (parsedInput.followUps?.length) {
      const oldFollowUpIds = new Set((oldObject?.followUps ?? []).map((f) => f.id));
      await checkSurveyFollowUpsPermission(
        organizationId,
        parsedInput.followUps.map((f) => f.id),
        oldFollowUpIds
      );
    }

    // Check external URLs permission (with grandfathering)
    await checkExternalUrlsPermission(organizationId, parsedInput, oldObject);
    const result = await updateSurvey(parsedInput);
    ctx.auditLoggingCtx.oldObject = oldObject;
    ctx.auditLoggingCtx.newObject = result;

    revalidatePath(`/environments/${result.environmentId}/surveys/${result.id}`);

    return result;
  })
);

const ZRefetchProjectAction = z.object({
  projectId: z.cuid2(),
});

export const refetchProjectAction = authenticatedActionClient
  .inputSchema(ZRefetchProjectAction)
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
  .inputSchema(ZGetImagesFromUnsplashAction)
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
    return results.map(
      (result: {
        id: string;
        alt_description: string;
        user: { first_name: string; last_name: string; links: { html: string } };
        urls: { regular: string };
        links: { download_location: string };
      }) => {
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
      }
    );
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
  downloadUrl: z.url(),
});

export const triggerDownloadUnsplashImageAction = actionClient
  .inputSchema(ZTriggerDownloadUnsplashImageAction)
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

export const createActionClassAction = authenticatedActionClient.inputSchema(ZCreateActionClassAction).action(
  withAuditLogging("created", "actionClass", async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.action.environmentId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: organizationId,
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

    ctx.auditLoggingCtx.organizationId = organizationId;
    const result = await createActionClass(parsedInput.action.environmentId, parsedInput.action);
    ctx.auditLoggingCtx.actionClassId = result.id;
    ctx.auditLoggingCtx.newObject = result;
    return result;
  })
);
