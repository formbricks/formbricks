import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import {
  getIsContactsEnabled,
  getIsSpamProtectionEnabled,
  getMultiLanguagePermission,
} from "@/modules/ee/license-check/lib/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getProjectLanguages } from "@/modules/survey/editor/lib/project";
import { getUserEmail } from "@/modules/survey/editor/lib/user";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { getActionClasses } from "@/modules/survey/lib/action-class";
import { getProjectByEnvironmentId } from "@/modules/survey/lib/project";
import { getResponseCountBySurveyId } from "@/modules/survey/lib/response";
import { getOrganizationBilling, getSurvey } from "@/modules/survey/lib/survey";
import { ErrorComponent } from "@/modules/ui/components/error-component";
import { getTranslate } from "@/tolgee/server";
import {
  DEFAULT_LOCALE,
  IS_FORMBRICKS_CLOUD,
  MAIL_FROM,
  SURVEY_BG_COLORS,
  UNSPLASH_ACCESS_KEY,
} from "@formbricks/lib/constants";
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
  const [survey, project, actionClasses, contactAttributeKeys, responseCount, segments] = await Promise.all([
    getSurvey(params.surveyId),
    getProjectByEnvironmentId(params.environmentId),
    getActionClasses(params.environmentId),
    getContactAttributeKeys(params.environmentId),
    getResponseCountBySurveyId(params.surveyId),
    getSegments(params.environmentId),
  ]);

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const organizationBilling = await getOrganizationBilling(project.organizationId);
  if (!organizationBilling) {
    throw new Error(t("common.organization_not_found"));
  }

  const isSurveyCreationDeletionDisabled = isMember && hasReadAccess;
  const locale = session.user.id ? await getUserLocale(session.user.id) : undefined;

  const isUserTargetingAllowed = await getIsContactsEnabled();
  const isMultiLanguageAllowed = await getMultiLanguagePermission(organizationBilling.plan);
  const isSurveyFollowUpsAllowed = await getSurveyFollowUpsPermission(organizationBilling.plan);
  const isSpamProtectionAllowed = await getIsSpamProtectionEnabled();

  const userEmail = await getUserEmail(session.user.id);

  const projectLanguages = await getProjectLanguages(project.id);

  if (
    !survey ||
    !environment ||
    !actionClasses ||
    !contactAttributeKeys ||
    !project ||
    !userEmail ||
    isSurveyCreationDeletionDisabled
  ) {
    return <ErrorComponent />;
  }

  const isCxMode = searchParams.mode === "cx";

  return (
    <SurveyEditor
      survey={survey}
      project={project}
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
      plan={organizationBilling.plan}
      isFormbricksCloud={IS_FORMBRICKS_CLOUD}
      isUnsplashConfigured={!!UNSPLASH_ACCESS_KEY}
      isCxMode={isCxMode}
      locale={locale ?? DEFAULT_LOCALE}
      mailFrom={MAIL_FROM ?? "hola@formbricks.com"}
      isSurveyFollowUpsAllowed={isSurveyFollowUpsAllowed}
      userEmail={userEmail}
    />
  );
};
