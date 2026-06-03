import { notFound } from "next/navigation";
import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { SurveyAnalysisNavigation } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { SummaryPage } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/SummaryPage";
import { SurveyAnalysisCTA } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/SurveyAnalysisCTA";
import { getSurveySummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/surveySummary";
import { getAISmartToolsUnavailableReason, getOrganizationAIConfig } from "@/lib/ai/service";
import {
  DEFAULT_LOCALE,
  ENTERPRISE_LICENSE_REQUEST_FORM_URL,
  IS_FORMBRICKS_CLOUD,
  IS_STORAGE_CONFIGURED,
} from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getSurvey } from "@/lib/survey/service";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled, getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

const SurveyPage = async (props: { params: Promise<{ workspaceId: string; surveyId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, isReadOnly, workspace, organization } = await getWorkspaceAuth(params.workspaceId);

  const surveyId = params.surveyId;

  if (!surveyId) {
    return notFound();
  }

  const survey = await getSurvey(params.surveyId);

  if (!survey) {
    throw new ResourceNotFoundError(t("common.survey"), params.surveyId);
  }

  const user = await getUser(session.user.id);

  if (!user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  const isContactsEnabled = await getIsContactsEnabled(organization.id);
  const segments = isContactsEnabled ? await getSegments(workspace.id) : [];

  if (!organization) {
    throw new ResourceNotFoundError(t("common.organization"), null);
  }
  const organizationBilling = await getOrganizationBilling(organization.id);
  if (!organizationBilling) {
    throw new ResourceNotFoundError(t("common.organization"), organization.id);
  }
  const isQuotasAllowed = await getIsQuotasEnabled(organization.id);

  const aiConfig = await getOrganizationAIConfig(organization.id);
  const aiUnavailableReason = getAISmartToolsUnavailableReason(aiConfig) ?? null;

  // Fetch initial survey summary data on the server to prevent duplicate API calls during hydration
  const initialSurveySummary = await getSurveySummary(surveyId);

  const publicDomain = getPublicDomain();

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={survey.name}
        cta={
          <SurveyAnalysisCTA
            isReadOnly={isReadOnly}
            user={user}
            publicDomain={publicDomain}
            responseCount={initialSurveySummary?.meta.totalResponses ?? 0}
            segments={segments}
            isContactsEnabled={isContactsEnabled}
            isFormbricksCloud={IS_FORMBRICKS_CLOUD}
            isStorageConfigured={IS_STORAGE_CONFIGURED}
            enterpriseLicenseRequestFormUrl={ENTERPRISE_LICENSE_REQUEST_FORM_URL}
            aiUnavailableReason={aiUnavailableReason}
          />
        }>
        <SurveyAnalysisNavigation survey={survey} activeId="summary" />
      </PageHeader>
      <SummaryPage
        survey={survey}
        surveyId={params.surveyId}
        locale={user.locale ?? DEFAULT_LOCALE}
        initialSurveySummary={initialSurveySummary}
        isQuotasAllowed={isQuotasAllowed}
      />

      <IdBadge id={surveyId} label={t("common.survey_id")} variant="column" />
    </PageContentWrapper>
  );
};

export default SurveyPage;
