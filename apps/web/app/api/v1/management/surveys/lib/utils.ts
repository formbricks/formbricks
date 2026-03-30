import { TOrganization } from "@formbricks/types/organizations";
import { TSurvey, TSurveyCreateInputWithEnvironmentId } from "@formbricks/types/surveys/types";
import { responses } from "@/app/lib/api/response";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";

export const checkFeaturePermissions = async (
  surveyData: TSurveyCreateInputWithEnvironmentId,
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
