import GoBackButton from "@/components/shared/GoBackButton";
import { getIntegrations } from "@formbricks/lib/integration/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { TAirTableIntegration, TAirtable } from "@formbricks/types/v1/integrations";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import AirTableWrapper from "./AirTableWrapper";
import { getAirtableTables } from "@/../../packages/lib/services/airTable";
import { getEnvironment } from "@formbricks/lib/environment/service";

export default async function AirTable({ params }) {
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
          airtableIntegration={airtableIntegration}
          airTableArray={airTableArray}
          environmentId={environment.id}
          surveys={surveys}
          environment={environment}
        />
      </div>
    </>
  );
}
