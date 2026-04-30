import "server-only";
import { listFeedbackRecords } from "@/modules/hub/service";

export const hasWorkspaceFeedbackRecords = async (workspaceId: string): Promise<boolean> => {
  const result = await listFeedbackRecords({ tenant_id: workspaceId, limit: 1 });

  if (result.error) {
    // Do not lock creation flows when record availability is unknown.
    return true;
  }

  return (result.data?.data?.length ?? 0) > 0;
};
