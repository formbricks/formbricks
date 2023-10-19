import AirtableWrapper from "@/app/(app)/environments/[environmentId]/integrations/airtable/components/AirtableWrapper";
import { getAirtableTables } from "@formbricks/lib/airtable/service";
import { AIR_TABLE_CLIENT_ID, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { TIntegrationItem } from "@formbricks/types/v1/integration";
import { TIntegrationAirtable } from "@formbricks/types/v1/integration/airtable";
import GoBackButton from "@formbricks/ui/GoBackButton";

export default async function Airtable({ params }) {
  const enabled = !!AIR_TABLE_CLIENT_ID;
  const [surveys, integrations, environment] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrations(params.environmentId),
    getEnvironment(params.environmentId),
  ]);
  if (!environment) {
    throw new Error("Environment not found");
  }

  const airtableIntegration: TIntegrationAirtable | undefined = integrations?.find(
    (integration): integration is TIntegrationAirtable => integration.type === "airtable"
  );

  let airtableArray: TIntegrationItem[] = [];
  if (airtableIntegration && airtableIntegration.config.key) {
    airtableArray = await getAirtableTables(params.environmentId);
  }

  return (
    <>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/integrations`} />
      <div className="h-[75vh] w-full">
        <AirtableWrapper
          enabled={enabled}
          airtableIntegration={airtableIntegration}
          airtableArray={airtableArray}
          environmentId={environment.id}
          surveys={surveys}
          environment={environment}
          webAppUrl={WEBAPP_URL}
        />
      </div>
    </>
  );
}
