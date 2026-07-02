import { redirect } from "next/navigation";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";

// Feedback Sources moved from workspace settings to org-level Unify Feedback (Stage 3).
export default async function FeedbackSourcesRedirect(
  props: Readonly<{ params: Promise<{ workspaceId: string }> }>
) {
  const { workspaceId } = await props.params;
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
  redirect(organizationSettingsPath(organizationId, "unify-feedback/sources"));
}
