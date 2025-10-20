import {
  DEFAULT_LOCALE,
  IS_FORMBRICKS_CLOUD,
  IS_STORAGE_CONFIGURED,
  MAIL_FROM,
  SURVEY_BG_COLORS,
  UNSPLASH_ACCESS_KEY,
} from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import {
  getIsContactsEnabled,
  getIsQuotasEnabled,
  getIsSpamProtectionEnabled,
  getMultiLanguagePermission,
} from "@/modules/ee/license-check/lib/utils";
import { getQuotas } from "@/modules/ee/quotas/lib/quotas";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getProjectLanguages } from "@/modules/survey/editor/lib/project";
import { getTeamMemberDetails } from "@/modules/survey/editor/lib/team";
import { getUserEmail } from "@/modules/survey/editor/lib/user";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { getActionClasses } from "@/modules/survey/lib/action-class";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { getProjectWithTeamIdsByEnvironmentId } from "@/modules/survey/lib/project";
import { getResponseCountBySurveyId } from "@/modules/survey/lib/response";
import { getOrganizationBilling, getSurvey } from "@/modules/survey/lib/survey";
import { ErrorComponent } from "@/modules/ui/components/error-component";
import { SurveyEditor } from "./components/survey-editor";
import { getUserLocale } from "./lib/user";

export const generateMetadata = async (props) => {
  const params = await props.params;
  const survey = await getSurvey(params.surveyId);
  return {
    title: survey?.name ? `${survey?.name} | Editor` : "Editor",
  };
};

export const SurveyEditorPage = async (props) => {
  const searchParams = await props.searchParams;
  const params = await props.params;

  const { session, isMember, environment, hasReadAccess, currentUserMembership, projectPermission } =
    await getEnvironmentAuth(params.environmentId);

  const t = await getTranslate();
  const [survey, projectWithTeamIds, actionClasses, contactAttributeKeys, responseCount, segments] =
    await Promise.all([
      getSurvey(params.surveyId),
      getProjectWithTeamIdsByEnvironmentId(params.environmentId),
      getActionClasses(params.environmentId),
      getContactAttributeKeys(params.environmentId),
      getResponseCountBySurveyId(params.surveyId),
      getSegments(params.environmentId),
    ]);

  if (!projectWithTeamIds) {
    throw new Error(t("common.project_not_found"));
  }

  const organizationBilling = await getOrganizationBilling(projectWithTeamIds.organizationId);
  if (!organizationBilling) {
    throw new Error(t("common.organization_not_found"));
  }

  const isSurveyCreationDeletionDisabled = isMember && hasReadAccess;
  const [locale, userEmail] = await Promise.all([
    getUserLocale(session.user.id),
    getUserEmail(session.user.id),
  ]);

  const isUserTargetingAllowed = await getIsContactsEnabled();
  const [
    isMultiLanguageAllowed,
    isSurveyFollowUpsAllowed,
    isSpamProtectionAllowed,
    isQuotasAllowed,
    isExternalUrlsAllowed,
  ] = await Promise.all([
    getMultiLanguagePermission(organizationBilling.plan),
    getSurveyFollowUpsPermission(organizationBilling.plan),
    getIsSpamProtectionEnabled(organizationBilling.plan),
    getIsQuotasEnabled(organizationBilling.plan),
    getExternalUrlsPermission(organizationBilling.plan),
  ]);

  const quotas = isQuotasAllowed && survey ? await getQuotas(survey.id) : [];
  const [projectLanguages, teamMemberDetails] = await Promise.all([
    getProjectLanguages(projectWithTeamIds.id),
    getTeamMemberDetails(projectWithTeamIds.teamIds),
  ]);

  if (
    !survey ||
    !environment ||
    !actionClasses ||
    !contactAttributeKeys ||
    !projectWithTeamIds ||
    !userEmail ||
    isSurveyCreationDeletionDisabled
  ) {
    return <ErrorComponent />;
  }

  const isCxMode = searchParams.mode === "cx";

  return (
    <SurveyEditor
      survey={survey}
      project={projectWithTeamIds}
      environment={environment}
      actionClasses={actionClasses}
      contactAttributeKeys={contactAttributeKeys}
      responseCount={responseCount}
      membershipRole={currentUserMembership.role}
      projectPermission={projectPermission}
      colors={SURVEY_BG_COLORS}
      segments={segments}
      isUserTargetingAllowed={isUserTargetingAllowed}
      isMultiLanguageAllowed={isMultiLanguageAllowed}
      isSpamProtectionAllowed={isSpamProtectionAllowed}
      projectLanguages={projectLanguages}
      isFormbricksCloud={IS_FORMBRICKS_CLOUD}
      isUnsplashConfigured={!!UNSPLASH_ACCESS_KEY}
      isCxMode={isCxMode}
      locale={locale ?? DEFAULT_LOCALE}
      mailFrom={MAIL_FROM ?? "hola@formbricks.com"}
      isSurveyFollowUpsAllowed={isSurveyFollowUpsAllowed}
      userEmail={userEmail}
      teamMemberDetails={teamMemberDetails}
      isStorageConfigured={IS_STORAGE_CONFIGURED}
      isQuotasAllowed={isQuotasAllowed}
      quotas={quotas}
      isExternalUrlsAllowed={isExternalUrlsAllowed}
    />
  );
};
