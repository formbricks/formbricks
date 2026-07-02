import { redirect } from "next/navigation";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";

// Feedback Records moved to org-level settings (Stage 2). Resolve the workspace's organization and
// redirect to the new dataset-scoped records view.
export default async function UnifyFeedbackRecordsPage(props: { params: Promise<{ workspaceId: string }> }) {
  const params = await props.params;
  const organizationId = await getOrganizationIdFromWorkspaceId(params.workspaceId);
  redirect(`/organizations/${organizationId}/settings/unify-feedback/datasets`);
}
