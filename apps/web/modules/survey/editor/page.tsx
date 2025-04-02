import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getProjectLanguages } from "@/modules/survey/editor/lib/project";
import { getUserEmail } from "@/modules/survey/editor/lib/user";
import { getActionClasses } from "@/modules/survey/lib/action-class";
import { getProjectByEnvironmentId } from "@/modules/survey/lib/project";
import { getResponseCountBySurveyId } from "@/modules/survey/lib/response";
import { getOrganizationBilling, getSurvey } from "@/modules/survey/lib/survey";
import { ErrorComponent } from "@/modules/ui/components/error-component";
import { getTranslate } from "@/tolgee/server";
import { DEFAULT_LOCALE, MAIL_FROM, SURVEY_BG_COLORS, UNSPLASH_ACCESS_KEY } from "@formbricks/lib/constants";
import { SurveyEditor } from "./components/survey-editor";

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

  const { session, isMember, environment, hasReadAccess, currentUserMembership } = await getEnvironmentAuth(
    params.environmentId
  );

  const t = await getTranslate();
  const [survey, project, actionClasses, responseCount] = await Promise.all([
    getSurvey(params.surveyId),
    getProjectByEnvironmentId(params.environmentId),
    getActionClasses(params.environmentId),
    getResponseCountBySurveyId(params.surveyId),
  ]);

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const organizationBilling = await getOrganizationBilling(project.organizationId);
  if (!organizationBilling) {
    throw new Error(t("common.organization_not_found"));
  }

  const isSurveyCreationDeletionDisabled = isMember && hasReadAccess;

  const isSurveyFollowUpsAllowed = false;
  const userEmail = await getUserEmail(session.user.id);

  if (
    !survey ||
    !environment ||
    !actionClasses ||
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
      responseCount={responseCount}
      membershipRole={currentUserMembership.role}
      colors={SURVEY_BG_COLORS}
      plan={organizationBilling.plan}
      isUnsplashConfigured={!!UNSPLASH_ACCESS_KEY}
      isCxMode={isCxMode}
      mailFrom={MAIL_FROM ?? "hola@formbricks.com"}
      isSurveyFollowUpsAllowed={isSurveyFollowUpsAllowed}
      userEmail={userEmail}
    />
  );
};
