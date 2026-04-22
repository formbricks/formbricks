import { notFound } from "next/navigation";
import { getTranslate } from "@/lingodotdev/server";
import { getFeedbackRecordDirectoriesByWorkspaceId } from "@/modules/ee/feedback-record-directory/lib/feedback-record-directory";
import { FeedbackRecordListResponse } from "@/modules/hub";
import { listFeedbackRecords } from "@/modules/hub/service";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { FeedbackRecordsPageClient } from "./feedback-records-page-client";

const INITIAL_PAGE_SIZE = 10;

export default async function UnifyFeedbackRecordsPage(props: {
  readonly params: Promise<{ workspaceId: string }>;
}) {
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

  // Preload first FRD's records server-side for fast initial render
  const initialFrdId = frds[0]?.id;
  let initialRecords: FeedbackRecordListResponse | null = null;

  if (initialFrdId) {
    const result = await listFeedbackRecords({ tenant_id: initialFrdId, limit: INITIAL_PAGE_SIZE });
    // Don't crash if Hub is down — show empty state
    if (!result.error) {
      initialRecords = result.data;
    }
  }

  return (
    <FeedbackRecordsPageClient
      workspaceId={params.workspaceId}
      directories={frds}
      initialFrdId={initialFrdId ?? null}
      initialRecords={initialRecords?.data ?? []}
      initialNextCursor={initialRecords?.next_cursor}
    />
  );
}
