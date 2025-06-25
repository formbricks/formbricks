import { responses } from "@/app/lib/api/response";
import { getIsSpamProtectionEnabled, getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { TOrganization } from "@formbricks/types/organizations";
import { TSurveyCreateInputWithEnvironmentId } from "@formbricks/types/surveys/types";

export const checkFeaturePermissions = async (
  surveyData: TSurveyCreateInputWithEnvironmentId,
  organization: TOrganization
): Promise<Response | null> => {
  if (surveyData.recaptcha?.enabled) {
    const isSpamProtectionEnabled = await getIsSpamProtectionEnabled(organization.billing.plan);
    if (!isSpamProtectionEnabled) {
      return responses.forbiddenResponse("Spam protection is not enabled for this organization");
    }
  }

  if (surveyData.followUps?.length) {
    const isSurveyFollowUpsEnabled = await getSurveyFollowUpsPermission(organization.billing.plan);
    if (!isSurveyFollowUpsEnabled) {
      return responses.forbiddenResponse("Survey follow ups are not allowed for this organization");
    }
  }

  if (surveyData.languages?.length) {
    const isMultiLanguageEnabled = await getMultiLanguagePermission(organization.billing.plan);
    if (!isMultiLanguageEnabled) {
      return responses.forbiddenResponse("Multi language is not enabled for this organization");
    }
  }

  return null;
};
