import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { SummaryPage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryPage";
import { SurveyAnalysisCTA } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SurveyAnalysisCTA";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getContactAttributeKeys } from "@formbricks/lib/services/contact-attribute-keys";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getUser } from "@formbricks/lib/user/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }: { params: { environmentId: string; surveyId: string } }) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }

  const surveyId = params.surveyId;

  if (!surveyId) {
    return notFound();
  }

  const [survey, environment, contactAttributeKeys] = await Promise.all([
    getSurvey(params.surveyId),
    getEnvironment(params.environmentId),
    getContactAttributeKeys(params.environmentId),
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

  const organization = await getOrganizationByEnvironmentId(params.environmentId);

  if (!organization) {
    throw new Error("Organization not found");
  }
  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const totalResponseCount = await getResponseCountBySurveyId(params.surveyId);

  const { isViewer } = getAccessFlags(currentUserMembership?.role);

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={survey.name}
        cta={
          <SurveyAnalysisCTA
            environment={environment}
            survey={survey}
            isViewer={isViewer}
            webAppUrl={WEBAPP_URL}
            user={user}
          />
        }>
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
        contactAttributeKeys={contactAttributeKeys}
      />
    </PageContentWrapper>
  );
};

export default Page;
