import { notFound } from "next/navigation";
import { getConnectorsWithMappings } from "@/lib/connector/service";
import { getSurveys } from "@/lib/survey/service";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { ConnectorsSection } from "./components/connectors-page-client";
import { transformToUnifySurvey } from "./lib";

export default async function UnifySourcesPage(props: { params: Promise<{ environmentId: string }> }) {
  const t = await getTranslate();
  const params = await props.params;

  const { isOwner, isManager, hasReadAccess, hasReadWriteAccess, hasManageAccess, session } =
    await getEnvironmentAuth(params.environmentId);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const hasAccess = isOwner || isManager || hasReadAccess || hasReadWriteAccess || hasManageAccess;
  if (!hasAccess) {
    return notFound();
  }

  const [connectors, surveys] = await Promise.all([
    getConnectorsWithMappings(params.environmentId),
    getSurveys(params.environmentId),
  ]);

  const unifySurveys = surveys.map(transformToUnifySurvey);

  return (
    <ConnectorsSection
      environmentId={params.environmentId}
      initialConnectors={connectors}
      initialSurveys={unifySurveys}
    />
  );
}
