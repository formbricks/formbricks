import { TOrganizationRole } from "@formbricks/types/memberships";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getTranslate } from "@/lingodotdev/server";
import { FeedbackRecordDirectoryTable } from "@/modules/ee/feedback-record-directory/components/feedback-record-directory-table";
import {
  getFeedbackRecordDirectories,
  getWorkspaceFeedbackRecordDirectoryAccess,
} from "@/modules/ee/feedback-record-directory/lib/feedback-record-directory";
import { getWorkspacesByOrganizationId } from "@/modules/ee/teams/team-list/lib/workspace";

interface FeedbackRecordDirectoryViewProps {
  organizationId: string;
  membershipRole: TOrganizationRole;
}

export const FeedbackRecordDirectoryView = async ({
  organizationId,
  membershipRole,
}: FeedbackRecordDirectoryViewProps) => {
  const t = await getTranslate();

  const [directories, orgWorkspaces, workspaceAccessByWorkspace] = await Promise.all([
    getFeedbackRecordDirectories(organizationId),
    getWorkspacesByOrganizationId(organizationId),
    getWorkspaceFeedbackRecordDirectoryAccess(organizationId),
  ]);

  return (
    <SettingsCard
      title={t("workspace.settings.feedback_record_directories.title")}
      description={t("workspace.settings.feedback_record_directories.description")}>
      <FeedbackRecordDirectoryTable
        directories={directories}
        organizationId={organizationId}
        orgWorkspaces={orgWorkspaces}
        workspaceAccessByWorkspace={workspaceAccessByWorkspace}
        membershipRole={membershipRole}
      />
    </SettingsCard>
  );
};
