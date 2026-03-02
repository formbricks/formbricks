import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { listFeedbackRecords } from "@/modules/hub/service";
import { FeedbackRecordsPageClient } from "./feedback-records-page-client";

const INITIAL_PAGE_SIZE = 50;

export default async function UnifyFeedbackRecordsPage(props: {
  params: Promise<{ environmentId: string }>;
}) {
  const params = await props.params;

  await getEnvironmentAuth(params.environmentId);

  const result = await listFeedbackRecords({
    tenant_id: params.environmentId,
    limit: INITIAL_PAGE_SIZE,
    offset: 0,
  });

  const initialData = result.data ?? { data: [], total: 0, limit: INITIAL_PAGE_SIZE, offset: 0 };

  return (
    <FeedbackRecordsPageClient
      environmentId={params.environmentId}
      initialRecords={initialData.data}
      initialTotal={initialData.total}
    />
  );
}
