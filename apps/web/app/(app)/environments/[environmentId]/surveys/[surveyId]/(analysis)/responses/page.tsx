import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { ResponsePage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponsePage";
import { SurveyAnalysisCTA } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SurveyAnalysisCTA";
import { IS_FORMBRICKS_CLOUD, IS_STORAGE_CONFIGURED, RESPONSES_PER_PAGE } from "@/lib/constants";
import { getDisplayCountBySurveyId } from "@/lib/display/service";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { getTagsByEnvironmentId } from "@/lib/tag/service";
import { getUser } from "@/lib/user/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getTranslate } from "@/lingodotdev/server";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled, getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getQuotas } from "@/modules/ee/quotas/lib/quotas";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getOrganizationIdFromEnvironmentId } from "@/modules/survey/lib/organization";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

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

  const isContactsEnabled = await getIsContactsEnabled();
  const segments = isContactsEnabled ? await getSegments(params.environmentId) : [];

  // Get response count for the CTA component
  const responseCount = await getResponseCountBySurveyId(params.surveyId);
  const displayCount = await getDisplayCountBySurveyId(params.surveyId);

  const locale = await findMatchingLocale();
  const publicDomain = getPublicDomain();

  const organizationId = await getOrganizationIdFromEnvironmentId(environment.id);
  if (!organizationId) {
    throw new Error(t("common.organization_not_found"));
  }
  const organizationBilling = await getOrganizationBilling(organizationId);
  if (!organizationBilling) {
    throw new Error(t("common.organization_not_found"));
  }

  const isQuotasAllowed = await getIsQuotasEnabled(organizationBilling.plan);

  const quotas = isQuotasAllowed ? await getQuotas(survey.id) : [];

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
            publicDomain={publicDomain}
            responseCount={responseCount}
            displayCount={displayCount}
            segments={segments}
            isContactsEnabled={isContactsEnabled}
            isFormbricksCloud={IS_FORMBRICKS_CLOUD}
            isStorageConfigured={IS_STORAGE_CONFIGURED}
          />
        }>
        <SurveyAnalysisNavigation environmentId={environment.id} survey={survey} activeId="responses" />
      </PageHeader>
      <ResponsePage
        environment={environment}
        survey={survey}
        surveyId={params.surveyId}
        environmentTags={tags}
        user={user}
        responsesPerPage={RESPONSES_PER_PAGE}
        locale={locale}
        isReadOnly={isReadOnly}
        isQuotasAllowed={isQuotasAllowed}
        quotas={quotas}
      />
    </PageContentWrapper>
  );
};

export default Page;
