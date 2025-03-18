import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { EnableInsightsBanner } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/EnableInsightsBanner";
import { SummaryPage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryPage";
import { SurveyAnalysisCTA } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SurveyAnalysisCTA";
import { needsInsightsGeneration } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/utils";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getIsAIEnabled } from "@/modules/ee/license-check/lib/utils";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import {
  DEFAULT_LOCALE,
  DOCUMENTS_PER_PAGE,
  MAX_RESPONSES_FOR_INSIGHT_GENERATION,
  WEBAPP_URL,
} from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getUser } from "@formbricks/lib/user/service";

const SurveyPage = async (props: { params: Promise<{ environmentId: string; surveyId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const surveyId = params.surveyId;

  if (!surveyId) {
    return notFound();
  }

  const [survey, environment] = await Promise.all([
    getSurvey(params.surveyId),
    getEnvironment(params.environmentId),
  ]);
  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }
  if (!survey) {
    throw new Error(t("common.survey_not_found"));
  }

  const project = await getProjectByEnvironmentId(environment.id);
  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new Error(t("common.user_not_found"));
  }

  const organization = await getOrganizationByEnvironmentId(params.environmentId);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }
  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const totalResponseCount = await getResponseCountBySurveyId(params.surveyId);

  const { isMember } = getAccessFlags(currentUserMembership?.role);
  const projectPermission = await getProjectPermissionByUserId(session.user.id, project.id);
  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);

  const isReadOnly = isMember && hasReadAccess;

  // I took this out cause it's cloud only right?
  // const { active: isEnterpriseEdition } = await getEnterpriseLicense();

  const isAIEnabled = await getIsAIEnabled({
    isAIEnabled: organization.isAIEnabled,
    billing: organization.billing,
  });
  const shouldGenerateInsights = needsInsightsGeneration(survey);

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={survey.name}
        cta={
          <SurveyAnalysisCTA environment={environment} survey={survey} isReadOnly={isReadOnly} user={user} />
        }>
        {isAIEnabled && shouldGenerateInsights && (
          <EnableInsightsBanner
            surveyId={survey.id}
            surveyResponseCount={totalResponseCount}
            maxResponseCount={MAX_RESPONSES_FOR_INSIGHT_GENERATION}
          />
        )}
        <SurveyAnalysisNavigation
          environmentId={environment.id}
          survey={survey}
          activeId="summary"
          initialTotalResponseCount={totalResponseCount}
        />
      </PageHeader>
      <SummaryPage
        environment={environment}
        survey={survey}
        surveyId={params.surveyId}
        webAppUrl={WEBAPP_URL}
        user={user}
        totalResponseCount={totalResponseCount}
        isAIEnabled={isAIEnabled}
        documentsPerPage={DOCUMENTS_PER_PAGE}
        isReadOnly={isReadOnly}
        locale={user.locale ?? DEFAULT_LOCALE}
      />
    </PageContentWrapper>
  );
};

export default SurveyPage;
