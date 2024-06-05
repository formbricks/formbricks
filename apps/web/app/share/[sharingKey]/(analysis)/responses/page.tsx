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

  const [survey, environment, product, tags] = await Promise.all([
    getSurvey(params.surveyId),
    getEnvironment(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
    getTagsByEnvironmentId(params.environmentId),
  ]);

  if (!survey) {
    throw new Error("Survey not found");
  }

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
            surveyId={survey.id}
            environmentId={environment.id}
            activeId="summary"
            responseCount={totalResponseCount}
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
