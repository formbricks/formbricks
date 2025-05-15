import { AirtableWrapper } from "@/app/(app)/environments/[environmentId]/integrations/airtable/components/AirtableWrapper";
import { getSurveys } from "@/app/(app)/environments/[environmentId]/integrations/lib/surveys";
import { getAirtableTables } from "@/lib/airtable/service";
import { AIRTABLE_CLIENT_ID, WEBAPP_URL } from "@/lib/constants";
import { getIntegrations } from "@/lib/integration/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { redirect } from "next/navigation";
import { TIntegrationItem } from "@formbricks/types/integration";
import { TIntegrationAirtable } from "@formbricks/types/integration/airtable";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslate();
  const isEnabled = !!AIRTABLE_CLIENT_ID;

  const { isReadOnly, environment } = await getEnvironmentAuth(params.environmentId);

  const [surveys, integrations] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrations(params.environmentId),
  ]);

  const airtableIntegration: TIntegrationAirtable | undefined = integrations?.find(
    (integration): integration is TIntegrationAirtable => integration.type === "airtable"
  );

  let airtableArray: TIntegrationItem[] = [];
  if (airtableIntegration?.config.key) {
    airtableArray = await getAirtableTables(params.environmentId);
  }

  const locale = await findMatchingLocale();

  if (isReadOnly) {
    redirect("./");
  }

  return (
    <PageContentWrapper>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/integrations`} />
      <PageHeader pageTitle={t("environments.integrations.airtable.airtable_integration")} />
      <div className="h-[75vh] w-full">
        <AirtableWrapper
          isEnabled={isEnabled}
          airtableIntegration={airtableIntegration}
          airtableArray={airtableArray}
          environmentId={environment.id}
          surveys={surveys}
          environment={environment}
          webAppUrl={WEBAPP_URL}
          locale={locale}
        />
      </div>
    </PageContentWrapper>
  );
};

export default Page;
