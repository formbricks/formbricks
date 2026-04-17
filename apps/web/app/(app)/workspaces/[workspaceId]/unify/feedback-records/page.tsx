import { notFound } from "next/navigation";
import { getTranslate } from "@/lingodotdev/server";
import { getFeedbackRecordDirectoriesByWorkspaceId } from "@/modules/ee/feedback-record-directory/lib/feedback-record-directory";
import { listFeedbackRecords } from "@/modules/hub/service";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { FeedbackRecordsPageClient } from "./feedback-records-page-client";

const INITIAL_PAGE_SIZE = 50;

export default async function UnifyFeedbackRecordsPage(props: { params: Promise<{ workspaceId: string }> }) {
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

  const frds = await getFeedbackRecordDirectoriesByWorkspaceId(params.workspaceId);

  const results = await Promise.all(
    frds.map((frd) => listFeedbackRecords({ tenant_id: frd.id, limit: INITIAL_PAGE_SIZE }))
  );

  // Don't crash if Hub is unreachable — show empty state
  const successfulResults = results.filter((r) => !r.error);

  const merged = successfulResults
    .flatMap((r) => r.data?.data ?? [])
    .sort((a, b) => (a.collected_at < b.collected_at ? 1 : -1))
    .slice(0, INITIAL_PAGE_SIZE);

  const frdMap = Object.fromEntries(frds.map((f) => [f.id, f.name]));

  return (
    <FeedbackRecordsPageClient workspaceId={params.workspaceId} initialRecords={merged} frdMap={frdMap} />
  );
}
