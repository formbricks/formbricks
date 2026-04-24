import { notFound } from "next/navigation";
import { ConnectorsSection } from "@/app/(app)/workspaces/[workspaceId]/unify/sources/components/connectors-page-client";
import { transformToUnifySurvey } from "@/app/(app)/workspaces/[workspaceId]/unify/sources/lib";
import { getConnectorsWithMappings } from "@/lib/connector/service";
import { getSurveys } from "@/lib/survey/service";
import { getTranslate } from "@/lingodotdev/server";
import { getFeedbackRecordDirectoriesByWorkspaceId } from "@/modules/ee/feedback-record-directory/lib/feedback-record-directory";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const WorkspaceSourcesPage = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
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
};
