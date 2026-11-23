import { TOrganizationRole } from "@formbricks/types/memberships";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getTranslate } from "@/lingodotdev/server";
import { FeedbackDirectoryTable } from "@/modules/ee/feedback-directory/components/feedback-directory-table";
import {
  getFeedbackDirectories,
  getWorkspaceFeedbackDirectoryAccess,
} from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsDashboardViewerRoleEnabled } from "@/modules/ee/license-check/lib/utils";
import { getWorkspacesByOrganizationId } from "@/modules/ee/teams/team-list/lib/workspace";

interface FeedbackDirectoryViewProps {
  readonly organizationId: string;
  readonly membershipRole: TOrganizationRole;
}

export const FeedbackDirectoryView = async ({
  organizationId,
  membershipRole,
}: FeedbackDirectoryViewProps) => {
  const t = await getTranslate();

  const [directories, orgWorkspaces, workspaceAccessByWorkspace, isDashboardViewerAccessEnabled] =
    await Promise.all([
      getFeedbackDirectories(organizationId),
      getWorkspacesByOrganizationId(organizationId),
      getWorkspaceFeedbackDirectoryAccess(organizationId),
      // Dashboard Viewer access needs what the role needs: Access Control and Dashboards (ENG-7476).
      getIsDashboardViewerRoleEnabled(organizationId),
    ]);

  return (
    <SettingsCard
      title={t("workspace.settings.feedback_directories.title")}
      description={t("workspace.settings.feedback_directories.description")}
      bodyVariant="flush">
      <FeedbackDirectoryTable
        directories={directories}
        organizationId={organizationId}
        orgWorkspaces={orgWorkspaces}
        workspaceAccessByWorkspace={workspaceAccessByWorkspace}
        membershipRole={membershipRole}
        isDashboardViewerAccessEnabled={isDashboardViewerAccessEnabled}
      />
    </SettingsCard>
  );
};
