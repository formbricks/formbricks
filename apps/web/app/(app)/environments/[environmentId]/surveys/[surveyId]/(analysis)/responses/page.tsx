import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { ResponsePage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponsePage";
import { SurveyAnalysisCTA } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SurveyAnalysisCTA";
import { RESPONSES_PER_PAGE, WEBAPP_URL } from "@/lib/constants";
import { getSurveyDomain } from "@/lib/getSurveyUrl";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { getTagsByEnvironmentId } from "@/lib/tag/service";
import { getUser } from "@/lib/user/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, environment, isReadOnly } = await getEnvironmentAuth(params.environmentId);

  const survey = await getSurvey(params.surveyId);

  if (!survey) {
    throw new Error(t("common.survey_not_found"));
  }

  const user = await getUser(session.user.id);

  if (!user) {
    throw new Error(t("common.user_not_found"));
  }

  const tags = await getTagsByEnvironmentId(params.environmentId);

  const totalResponseCount = await getResponseCountBySurveyId(params.surveyId);

  const locale = await findMatchingLocale();
  const surveyDomain = getSurveyDomain();

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={survey.name}
        cta={
          <SurveyAnalysisCTA
            environment={environment}
            survey={survey}
            isReadOnly={isReadOnly}
            user={user}
            surveyDomain={surveyDomain}
            responseCount={totalResponseCount}
          />
        }>
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
        locale={locale}
        isReadOnly={isReadOnly}
      />
    </PageContentWrapper>
  );
};

export default Page;
