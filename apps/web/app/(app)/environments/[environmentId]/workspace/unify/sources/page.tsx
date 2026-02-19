import { getConnectorsWithMappings } from "@/lib/connector/service";
import { getSurveys } from "@/lib/survey/service";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { SourcesSection } from "./components/sources-page-client";
import { transformToUnifySurvey } from "./lib";

export default async function UnifySourcesPage(props: { params: Promise<{ environmentId: string }> }) {
  const params = await props.params;

  await getEnvironmentAuth(params.environmentId);

  const [connectors, surveys] = await Promise.all([
    getConnectorsWithMappings(params.environmentId),
    getSurveys(params.environmentId),
  ]);

  const unifySurveys = surveys.map(transformToUnifySurvey);

  return (
    <SourcesSection
      environmentId={params.environmentId}
      initialConnectors={connectors}
      initialSurveys={unifySurveys}
    />
  );
}
