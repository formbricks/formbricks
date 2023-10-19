import AirTableWrapper from "@/app/(app)/environments/[environmentId]/integrations/airtable/components/AirTableWrapper";
import { getAirtableTables } from "@formbricks/lib/airTable/service";
import { AIR_TABLE_CLIENT_ID, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { TAirTableIntegration, TAirtable } from "@formbricks/types/v1/integrations";
import GoBackButton from "@formbricks/ui/GoBackButton";

export default async function AirTable({ params }) {
  const enabled = !!AIR_TABLE_CLIENT_ID;
  const [surveys, integrations, environment] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrations(params.environmentId),
    getEnvironment(params.environmentId),
  ]);
  if (!environment) {
    throw new Error("Environment not found");
  }

  const airtableIntegration: TAirTableIntegration | undefined = integrations?.find(
    (integration): integration is TAirTableIntegration => integration.type === "airtable"
  );

  let airTableArray: TAirtable[] = [];
  if (airtableIntegration && airtableIntegration.config.key) {
    airTableArray = await getAirtableTables(params.environmentId);
  }

  return (
    <>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/integrations`} />
      <div className="h-[75vh] w-full">
        <AirTableWrapper
          enabled={enabled}
          airtableIntegration={airtableIntegration}
          airTableArray={airTableArray}
          environmentId={environment.id}
          surveys={surveys}
          environment={environment}
          webAppUrl={WEBAPP_URL}
        />
      </div>
    </>
  );
}
