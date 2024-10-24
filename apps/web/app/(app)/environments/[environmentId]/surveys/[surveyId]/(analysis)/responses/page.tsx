import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { ResponsePage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponsePage";
import { EnableInsightsBanner } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/EnableInsightsBanner";
import { SurveyAnalysisCTA } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SurveyAnalysisCTA";
import { needsInsightsGeneration } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/utils";
import { getIsAIEnabled } from "@/app/lib/utils";
import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import {
  MAX_RESPONSES_FOR_INSIGHT_GENERATION,
  RESPONSES_PER_PAGE,
  WEBAPP_URL,
} from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { getUser } from "@formbricks/lib/user/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }
  const [survey, environment] = await Promise.all([
    getSurvey(params.surveyId),
    getEnvironment(params.environmentId),
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }
  if (!survey) {
    throw new Error("Survey not found");
  }
  const product = await getProductByEnvironmentId(environment.id);
  if (!product) {
    throw new Error("Product not found");
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new Error("User not found");
  }
  const tags = await getTagsByEnvironmentId(params.environmentId);
  const organization = await getOrganizationByEnvironmentId(params.environmentId);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const totalResponseCount = await getResponseCountBySurveyId(params.surveyId);

  const { isMember } = getAccessFlags(currentUserMembership?.organizationRole);

  const isAIEnabled = await getIsAIEnabled(organization);
  const shouldGenerateInsights = needsInsightsGeneration(survey);

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={survey.name}
        cta={
          <SurveyAnalysisCTA
            environment={environment}
            survey={survey}
            isMember={isMember}
            webAppUrl={WEBAPP_URL}
            user={user}
          />
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
          activeId="responses"
          initialTotalResponseCount={totalResponseCount}
        />
      </PageHeader>
      <ResponsePage
        environment={environment}
        survey={survey}
        surveyId={params.surveyId}
        webAppUrl={WEBAPP_URL}
        environmentTags={tags}
        user={user}
        responsesPerPage={RESPONSES_PER_PAGE}
      />
    </PageContentWrapper>
  );
};

export default Page;
