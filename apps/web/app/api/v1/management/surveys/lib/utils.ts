import { TOrganization } from "@formbricks/types/organizations";
import { TSurvey, TSurveyCreateInputWithWorkspaceId } from "@formbricks/types/surveys/types";
import { responses } from "@/app/lib/api/response";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import {
  CUSTOM_HEAD_SCRIPTS_PERMISSION_MESSAGE,
  canWriteCustomHeadScripts,
} from "@/modules/survey/lib/custom-head-scripts-permission";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";

export const checkFeaturePermissions = async (
  surveyData: TSurveyCreateInputWithWorkspaceId,
  organization: TOrganization,
  oldSurvey?: TSurvey
): Promise<Response | null> => {
  if (surveyData.recaptcha?.enabled) {
    const isSpamProtectionEnabled = await getIsSpamProtectionEnabled(organization.id);
    if (!isSpamProtectionEnabled) {
      return responses.forbiddenResponse("Spam protection is not enabled for this organization");
    }
  }

  if (surveyData.followUps?.length) {
    const isSurveyFollowUpsEnabled = await getSurveyFollowUpsPermission(organization.id);
    if (!isSurveyFollowUpsEnabled) {
      return responses.forbiddenResponse("Survey follow ups are not allowed for this organization");
    }
  }

  const isExternalUrlsAllowed = await getExternalUrlsPermission(organization.id);
  if (!isExternalUrlsAllowed) {
    // Check ending cards for new/changed button links
    if (surveyData.endings) {
      for (const newEnding of surveyData.endings) {
        const oldEnding = oldSurvey?.endings.find((e) => e.id === newEnding.id);

        if (newEnding.type === "endScreen" && newEnding.buttonLink) {
          if (!oldEnding || oldEnding.type !== "endScreen" || oldEnding.buttonLink !== newEnding.buttonLink) {
            return responses.forbiddenResponse(
              "External URLs are not enabled for this organization. Upgrade to use external button links."
            );
          }
        }
      }
    }

    // Check CTA elements for new/changed external button URLs
    if (surveyData.blocks) {
      const newElements = getElementsFromBlocks(surveyData.blocks);
      const oldElements = oldSurvey?.blocks ? getElementsFromBlocks(oldSurvey.blocks) : [];

      for (const newElement of newElements) {
        const oldElement = oldElements.find((e) => e.id === newElement.id);

        if (newElement.type === "cta" && newElement.buttonExternal) {
          if (
            !oldElement ||
            oldElement.type !== "cta" ||
            !oldElement.buttonExternal ||
            oldElement.buttonUrl !== newElement.buttonUrl
          ) {
            return responses.forbiddenResponse(
              "External URLs are not enabled for this organization. Upgrade to use external CTA buttons."
            );
          }
        }
      }
    }
  }

  return null;
};

/**
 * Every permission a v1 survey write needs beyond the route's `workspace.write` check: the
 * organization's feature entitlements, then `workspace.manage` for the API key when the write changes
 * the survey's custom head scripts.
 */
export const checkSurveyWritePermissions = async (
  surveyData: TSurveyCreateInputWithWorkspaceId,
  organization: TOrganization,
  apiKey: { apiKeyId: string; workspaceId: string },
  oldSurvey?: TSurvey
): Promise<Response | null> => {
  const featureCheckResult = await checkFeaturePermissions(surveyData, organization, oldSurvey);
  if (featureCheckResult) {
    return featureCheckResult;
  }

  const canWriteScripts = await canWriteCustomHeadScripts(
    { type: "apiKey", id: apiKey.apiKeyId },
    apiKey.workspaceId,
    surveyData,
    oldSurvey ?? null
  );
  return canWriteScripts ? null : responses.forbiddenResponse(CUSTOM_HEAD_SCRIPTS_PERMISSION_MESSAGE);
};

export const V1_CUSTOM_CSS_UNSUPPORTED_MESSAGE =
  "customCss is not supported by the v1 management API. Use PATCH /api/v3/surveys/{surveyId} to read or change survey custom CSS.";

/**
 * ENG-2949: the legacy API never accepts custom CSS. Every CSS write runs through the shared processor and
 * plan check, which v1 has no way to report on (no warnings, no CSS errors), so a body carrying the key is
 * refused rather than silently dropped. v1 responses do not echo the field, so a GET → PUT round trip
 * never sends it back.
 */
export const refuseV1CustomCss = (body: unknown): Response | null =>
  typeof body === "object" && body !== null && Object.hasOwn(body, "customCss")
    ? responses.badRequestResponse(V1_CUSTOM_CSS_UNSUPPORTED_MESSAGE)
    : null;
