import { TOrganization } from "@formbricks/types/organizations";
import { TSurvey, TSurveyCreateInputWithWorkspaceId } from "@formbricks/types/surveys/types";
import { responses } from "@/app/lib/api/response";
import { isDefaultEndingCardButtonLink } from "@/lib/survey/default-ending-card";
import { addsRichTextLink } from "@/lib/survey/rich-text-links";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import {
  CUSTOM_HEAD_SCRIPTS_PERMISSION_MESSAGE,
  canWriteCustomHeadScripts,
} from "@/modules/survey/lib/custom-head-scripts-permission";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";

/** Whether the survey adds or changes an ending card's external button link. */
const addsExternalEndingLink = (
  surveyData: TSurveyCreateInputWithWorkspaceId,
  oldSurvey: TSurvey | undefined
): boolean =>
  (surveyData.endings ?? []).some((newEnding) => {
    if (
      newEnding.type !== "endScreen" ||
      !newEnding.buttonLink ||
      isDefaultEndingCardButtonLink(newEnding.buttonLink)
    ) {
      return false;
    }
    const oldEnding = oldSurvey?.endings.find((e) => e.id === newEnding.id);
    return !oldEnding || oldEnding.type !== "endScreen" || oldEnding.buttonLink !== newEnding.buttonLink;
  });

/** Whether the survey adds or changes a CTA element's external button URL. */
const addsExternalCtaUrl = (
  surveyData: TSurveyCreateInputWithWorkspaceId,
  oldSurvey: TSurvey | undefined
): boolean => {
  if (!surveyData.blocks) return false;
  const newElements = getElementsFromBlocks(surveyData.blocks);
  const oldElements = oldSurvey?.blocks ? getElementsFromBlocks(oldSurvey.blocks) : [];

  return newElements.some((newElement) => {
    if (newElement.type !== "cta" || !newElement.buttonExternal) return false;
    const oldElement = oldElements.find((e) => e.id === newElement.id);
    return (
      !oldElement ||
      oldElement.type !== "cta" ||
      !oldElement.buttonExternal ||
      oldElement.buttonUrl !== newElement.buttonUrl
    );
  });
};

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
  if (isExternalUrlsAllowed) return null;

  // Check ending cards for new/changed button links
  if (addsExternalEndingLink(surveyData, oldSurvey)) {
    return responses.forbiddenResponse(
      "External URLs are not enabled for this organization. Upgrade to use external button links."
    );
  }

  // Check CTA elements for new/changed external button URLs
  if (addsExternalCtaUrl(surveyData, oldSurvey)) {
    return responses.forbiddenResponse(
      "External URLs are not enabled for this organization. Upgrade to use external CTA buttons."
    );
  }

  // Check rich text (headlines, subheaders, welcome and ending cards) for new links (ENG-3891)
  if (addsRichTextLink(surveyData, oldSurvey)) {
    return responses.forbiddenResponse(
      "External URLs are not enabled for this organization. Upgrade to use links in survey text."
    );
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
