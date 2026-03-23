import { redirect } from "next/navigation";
import { TIntegrationItem } from "@formbricks/types/integration";
import { TIntegrationAirtable } from "@formbricks/types/integration/airtable";
import { AirtableWrapper } from "@/app/(app)/environments/[environmentId]/workspace/integrations/airtable/components/AirtableWrapper";
import { getSurveys } from "@/app/(app)/environments/[environmentId]/workspace/integrations/lib/surveys";
import { getAirtableTables } from "@/lib/airtable/service";
import { AIRTABLE_CLIENT_ID, DEFAULT_LOCALE, WEBAPP_URL } from "@/lib/constants";
import { getIntegrations } from "@/lib/integration/service";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const Page = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();
  const isEnabled = !!AIRTABLE_CLIENT_ID;

  const { isReadOnly, environment, session } = await getEnvironmentAuth(params.environmentId);

  const [surveys, integrations, locale] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrations(params.environmentId),
    getUserLocale(session.user.id),
  ]);

  const airtableIntegration: TIntegrationAirtable | undefined = integrations?.find(
    (integration): integration is TIntegrationAirtable => integration.type === "airtable"
  );

  let airtableArray: TIntegrationItem[] = [];
  if (airtableIntegration?.config.key) {
    airtableArray = await getAirtableTables(params.environmentId);
  }
  if (isReadOnly) {
    return redirect("./");
  }

  return (
    <PageContentWrapper>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/workspace/integrations`} />
      <PageHeader pageTitle={t("environments.integrations.airtable.airtable_integration")} />
      <div className="h-[75vh] w-full">
        <AirtableWrapper
          isEnabled={isEnabled}
          airtableIntegration={airtableIntegration}
          airtableArray={airtableArray}
          environmentId={environment.id}
          surveys={surveys}
          webAppUrl={WEBAPP_URL}
          locale={locale ?? DEFAULT_LOCALE}
        />
      </div>
    </PageContentWrapper>
  );
};

export default Page;
