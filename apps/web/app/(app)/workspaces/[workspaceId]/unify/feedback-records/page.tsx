import { notFound } from "next/navigation";
import { getTranslate } from "@/lingodotdev/server";
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

  const result = await listFeedbackRecords({
    tenant_id: params.workspaceId,
    limit: INITIAL_PAGE_SIZE,
  });

  if (result.error) {
    throw new Error(t("workspace.unify.failed_to_load_feedback_records"));
  }

  const initialData = result.data ?? { data: [], limit: INITIAL_PAGE_SIZE };

  return (
    <FeedbackRecordsPageClient
      workspaceId={params.workspaceId}
      initialRecords={initialData.data}
      initialNextCursor={initialData.next_cursor}
    />
  );
}
