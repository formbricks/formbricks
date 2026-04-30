import { notFound } from "next/navigation";
import { getConnectorsWithMappings } from "@/lib/connector/service";
import { getTranslate } from "@/lingodotdev/server";
import { listFeedbackRecords } from "@/modules/hub/service";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { FeedbackRecordsPageClient } from "./components/feedback-records-page-client";

const INITIAL_PAGE_SIZE = 50;

export default async function UnifyFeedbackRecordsPage(
  props: Readonly<{ params: Promise<{ workspaceId: string }> }>
) {
  const t = await getTranslate();
  const params = await props.params;

  const { isOwner, isManager, hasReadAccess, hasReadWriteAccess, hasManageAccess, session } =
    await getWorkspaceAuth(params.workspaceId);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const hasAccess = isOwner || isManager || hasReadAccess || hasReadWriteAccess || hasManageAccess;
  const canWrite = isOwner || isManager || hasReadWriteAccess || hasManageAccess;
  if (!hasAccess) {
    return notFound();
  }

  const [recordsResult, connectors] = await Promise.all([
    listFeedbackRecords({ tenant_id: params.workspaceId, limit: INITIAL_PAGE_SIZE }),
    getConnectorsWithMappings(params.workspaceId),
  ]);

  // Don't crash if Hub is unreachable — show empty state
  const initialRecords = recordsResult.error ? [] : (recordsResult.data?.data ?? []);

  const csvSources = connectors
    .filter((connector) => connector.type === "csv")
    .map((connector) => ({ id: connector.id, name: connector.name }));

  return (
    <FeedbackRecordsPageClient
      workspaceId={params.workspaceId}
      initialRecords={initialRecords}
      csvSources={csvSources}
      canWrite={canWrite}
    />
  );
}
