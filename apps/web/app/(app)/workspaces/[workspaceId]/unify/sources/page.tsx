import { notFound } from "next/navigation";
import { getConnectorsWithMappings } from "@/lib/connector/service";
import { getSurveys } from "@/lib/survey/service";
import { getTranslate } from "@/lingodotdev/server";
import { getFeedbackRecordDirectoriesByWorkspaceId } from "@/modules/ee/feedback-record-directory/lib/feedback-record-directory";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { ConnectorsSection } from "./components/connectors-page-client";
import { transformToUnifySurvey } from "./lib";

export default async function UnifySourcesPage(props: { params: Promise<{ workspaceId: string }> }) {
  const t = await getTranslate();
  const params = await props.params;

  const { isOwner, isManager, hasReadAccess, hasReadWriteAccess, hasManageAccess, session } =
    await getWorkspaceAuth(params.workspaceId);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const hasAccess = isOwner || isManager || hasReadAccess || hasReadWriteAccess || hasManageAccess;
  if (!hasAccess) {
    return notFound();
  }

  const [connectors, surveys, directories] = await Promise.all([
    getConnectorsWithMappings(params.workspaceId),
    getSurveys(params.workspaceId),
    getFeedbackRecordDirectoriesByWorkspaceId(params.workspaceId),
  ]);

  const unifySurveys = surveys.map(transformToUnifySurvey);

  return (
    <ConnectorsSection
      workspaceId={params.workspaceId}
      initialConnectors={connectors}
      initialSurveys={unifySurveys}
      directories={directories}
    />
  );
}
