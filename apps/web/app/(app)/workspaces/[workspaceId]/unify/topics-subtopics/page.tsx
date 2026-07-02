import { redirect } from "next/navigation";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";

// Topics & Subtopics moved from the workspace-scoped Unify config to org-level Unify Feedback (Stage 4).
// Resolve the workspace's organization and redirect to the new org-scoped topics view.
export default async function UnifyTopicsSubtopicsPage(props: { params: Promise<{ workspaceId: string }> }) {
  const params = await props.params;
  const organizationId = await getOrganizationIdFromWorkspaceId(params.workspaceId);
  redirect(organizationSettingsPath(organizationId, "unify-feedback/topics"));
}
