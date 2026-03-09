import { notFound } from "next/navigation";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { listFeedbackRecords } from "@/modules/hub/service";
import { FeedbackRecordsPageClient } from "./feedback-records-page-client";

const INITIAL_PAGE_SIZE = 50;

export default async function UnifyFeedbackRecordsPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
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

  const result = await listFeedbackRecords({
    tenant_id: params.environmentId,
    limit: INITIAL_PAGE_SIZE,
    offset: 0,
  });

  if (result.error) {
    throw new Error(t("environments.unify.failed_to_load_feedback_records"));
  }

  const initialData = result.data ?? { data: [], total: 0, limit: INITIAL_PAGE_SIZE, offset: 0 };

  return (
    <FeedbackRecordsPageClient
      environmentId={params.environmentId}
      initialRecords={initialData.data}
      initialTotal={initialData.total}
    />
  );
}
