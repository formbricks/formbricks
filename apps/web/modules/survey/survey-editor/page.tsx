import { authOptions } from "@/modules/auth/lib/authOptions";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contacts";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled, getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getSurveyFollowUpsPermission } from "@/modules/survey-follow-ups/lib/utils";
import { getActionClasses } from "@/modules/survey/survey-editor/lib/action-class";
import { getEnvironment } from "@/modules/survey/survey-editor/lib/environment";
import { getOrganizationBilling } from "@/modules/survey/survey-editor/lib/organization";
import { getProjectByEnvironmentId, getProjectLanguages } from "@/modules/survey/survey-editor/lib/project";
import { getUserEmail } from "@/modules/survey/survey-editor/lib/user";
import { ErrorComponent } from "@/modules/ui/components/error-component";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import {
  DEFAULT_LOCALE,
  IS_FORMBRICKS_CLOUD,
  MAIL_FROM,
  SURVEY_BG_COLORS,
  UNSPLASH_ACCESS_KEY,
} from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getSurvey } from "@formbricks/lib/survey/service";
import { SurveyEditor } from "./components/survey-editor";
import { getResponseCountBySurveyId } from "./lib/response";
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
  const t = await getTranslations();
  const [
    survey,
    project,
    environment,
    actionClasses,
    contactAttributeKeys,
    responseCount,
    organization,
    session,
    segments,
  ] = await Promise.all([
    getSurvey(params.surveyId),
    getProjectByEnvironmentId(params.environmentId),
    getEnvironment(params.environmentId),
    getActionClasses(params.environmentId),
    getContactAttributeKeys(params.environmentId),
    getResponseCountBySurveyId(params.surveyId),
    getOrganizationBilling(params.environmentId),
    getServerSession(authOptions),
    getSegments(params.environmentId),
  ]);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const projectPermission = await getProjectPermissionByUserId(session.user.id, project.id);

  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);

  const isSurveyCreationDeletionDisabled = isMember && hasReadAccess;
  const locale = session.user.id ? await getUserLocale(session.user.id) : undefined;

  const isUserTargetingAllowed = await getIsContactsEnabled();
  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization.billing.plan);
  const isSurveyFollowUpsAllowed = await getSurveyFollowUpsPermission(organization.billing.plan);

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
      membershipRole={currentUserMembership?.role}
      projectPermission={projectPermission}
      colors={SURVEY_BG_COLORS}
      segments={segments}
      isUserTargetingAllowed={isUserTargetingAllowed}
      isMultiLanguageAllowed={isMultiLanguageAllowed}
      projectLanguages={projectLanguages}
      plan={organization.billing.plan}
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
