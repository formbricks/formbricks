import { checkMultiLanguagePermission } from "@/modules/ee/multi-language-surveys/lib/actions";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { checkSpamProtectionPermission } from "@/modules/survey/lib/permission";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";

export interface TImportCapabilities {
  hasMultiLanguage: boolean;
  hasFollowUps: boolean;
  hasRecaptcha: boolean;
}

export const resolveImportCapabilities = async (organizationId: string): Promise<TImportCapabilities> => {
  let hasMultiLanguage = false;
  try {
    await checkMultiLanguagePermission(organizationId);
    hasMultiLanguage = true;
  } catch (e) {}

  let hasFollowUps = false;
  try {
    const organizationBilling = await getOrganizationBilling(organizationId);
    if (organizationBilling) {
      hasFollowUps = await getSurveyFollowUpsPermission(organizationBilling.plan);
    }
  } catch (e) {}

  let hasRecaptcha = false;
  try {
    await checkSpamProtectionPermission(organizationId);
    hasRecaptcha = true;
  } catch (e) {}

  return { hasMultiLanguage, hasFollowUps, hasRecaptcha };
};
