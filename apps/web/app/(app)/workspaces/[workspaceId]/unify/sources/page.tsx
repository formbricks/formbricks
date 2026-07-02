import { redirect } from "next/navigation";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";

// Feedback Sources moved from workspace settings to org-level Unify Feedback (Stage 3).
export default async function UnifySourcesPage(props: { params: Promise<{ workspaceId: string }> }) {
  const params = await props.params;
  const organizationId = await getOrganizationIdFromWorkspaceId(params.workspaceId);
  redirect(organizationSettingsPath(organizationId, "unify-feedback/sources"));
}
