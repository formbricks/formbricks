import { notFound } from "next/navigation";
import { getConnectorsWithMappings } from "@/lib/connector/service";
import { getTranslate } from "@/lingodotdev/server";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
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

  const [frds, connectors] = await Promise.all([
    getFeedbackDirectoriesByWorkspaceId(params.workspaceId),
    getConnectorsWithMappings(params.workspaceId),
  ]);

  const results = await Promise.all(
    frds.map((frd) => listFeedbackRecords({ tenant_id: frd.id, limit: INITIAL_PAGE_SIZE }))
  );

  // Don't crash if Hub is unreachable — show empty state
  const successfulResults = results.filter((r) => !r.error);

  const merged = successfulResults
    .flatMap((r) => r.data?.data ?? [])
    .toSorted((a, b) => (a.collected_at < b.collected_at ? 1 : -1));

  // Build per-FRD cursor map so the client can paginate
  const initialCursors: Record<string, string> = {};
  for (let i = 0; i < frds.length; i++) {
    const cursor = results[i]?.data?.next_cursor;
    if (cursor) {
      initialCursors[frds[i].id] = cursor;
    }
  }

  const frdMap = Object.fromEntries(frds.map((f) => [f.id, f.name]));
  const csvSources = connectors
    .filter((connector) => connector.type === "csv")
    .map((connector) => ({ id: connector.id, name: connector.name }));

  return (
    <FeedbackRecordsPageClient
      workspaceId={params.workspaceId}
      initialRecords={merged}
      initialCursors={initialCursors}
      frdMap={frdMap}
      csvSources={csvSources}
      canWrite={canWrite}
    />
  );
}
