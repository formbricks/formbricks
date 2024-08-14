import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { ResponsePage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponsePage";
import { notFound } from "next/navigation";
import { RESPONSES_PER_PAGE, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey, getSurveyIdByResultShareKey } from "@formbricks/lib/survey/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

const Page = async ({ params }) => {
  const surveyId = await getSurveyIdByResultShareKey(params.sharingKey);

  if (!surveyId) {
    return notFound();
  }
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new Error("Survey not found");
  }
  const environmentId = survey.environmentId;
  const [environment, product, tags] = await Promise.all([
    getEnvironment(environmentId),
    getProductByEnvironmentId(environmentId),
    getTagsByEnvironmentId(environmentId),
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }
  if (!product) {
    throw new Error("Product not found");
  }

  const totalResponseCount = await getResponseCountBySurveyId(surveyId);

  return (
    <div className="flex w-full justify-center">
      <PageContentWrapper className="w-full">
        <PageHeader pageTitle={survey.name}>
          <SurveyAnalysisNavigation
            survey={survey}
            environmentId={environment.id}
            activeId="responses"
            initialTotalResponseCount={totalResponseCount}
          />
        </PageHeader>
        <ResponsePage
          environment={environment}
          survey={survey}
          surveyId={surveyId}
          webAppUrl={WEBAPP_URL}
          environmentTags={tags}
          responsesPerPage={RESPONSES_PER_PAGE}
          totalResponseCount={totalResponseCount}
        />
      </PageContentWrapper>
    </div>
  );
};

export default Page;
