import { authOptions } from "@/modules/auth/lib/authOptions";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled, getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getProjectLanguages } from "@/modules/survey/editor/lib/project";
import { getUserEmail } from "@/modules/survey/editor/lib/user";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { getActionClasses } from "@/modules/survey/lib/action-class";
import { getEnvironment } from "@/modules/survey/lib/environment";
import { getMembershipRoleByUserIdOrganizationId } from "@/modules/survey/lib/membership";
import { getProjectByEnvironmentId } from "@/modules/survey/lib/project";
import { getResponseCountBySurveyId } from "@/modules/survey/lib/response";
import { getOrganizationBilling, getSurvey } from "@/modules/survey/lib/survey";
import { ErrorComponent } from "@/modules/ui/components/error-component";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import {
  DEFAULT_LOCALE,
  IS_FORMBRICKS_CLOUD,
  MAIL_FROM,
  SURVEY_BG_COLORS,
  UNSPLASH_ACCESS_KEY,
} from "@formbricks/lib/constants";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
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
  const t = await getTranslate();
  const [
    survey,
    project,
    environment,
    actionClasses,
    contactAttributeKeys,
    responseCount,
    session,
    segments,
  ] = await Promise.all([
    getSurvey(params.surveyId),
    getProjectByEnvironmentId(params.environmentId),
    getEnvironment(params.environmentId),
    getActionClasses(params.environmentId),
    getContactAttributeKeys(params.environmentId),
    getResponseCountBySurveyId(params.surveyId),
    getServerSession(authOptions),
    getSegments(params.environmentId),
  ]);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const organizationBilling = await getOrganizationBilling(project.organizationId);
  if (!organizationBilling) {
    throw new Error(t("common.organization_not_found"));
  }

  const membershipRole = await getMembershipRoleByUserIdOrganizationId(
    session?.user.id,
    project.organizationId
  );
  const { isMember } = getAccessFlags(membershipRole);

  const projectPermission = await getProjectPermissionByUserId(session.user.id, project.id);

  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);

  const isSurveyCreationDeletionDisabled = isMember && hasReadAccess;
  const locale = session.user.id ? await getUserLocale(session.user.id) : undefined;

  const isUserTargetingAllowed = await getIsContactsEnabled();
  const isMultiLanguageAllowed = await getMultiLanguagePermission(organizationBilling.plan);
  const isSurveyFollowUpsAllowed = await getSurveyFollowUpsPermission(organizationBilling.plan);

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
      membershipRole={membershipRole}
      projectPermission={projectPermission}
      colors={SURVEY_BG_COLORS}
      segments={segments}
      isUserTargetingAllowed={isUserTargetingAllowed}
      isMultiLanguageAllowed={isMultiLanguageAllowed}
      projectLanguages={projectLanguages}
      plan={organizationBilling.plan}
      isFormbricksCloud={IS_FORMBRICKS_CLOUD}
      isUnsplashConfigured={UNSPLASH_ACCESS_KEY ? true : false}
      isCxMode={isCxMode}
      locale={locale ?? DEFAULT_LOCALE}
      mailFrom={MAIL_FROM ?? "hola@formbricks.com"}
      isSurveyFollowUpsAllowed={isSurveyFollowUpsAllowed}
      userEmail={userEmail}
    />
  );
};
