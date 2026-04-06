import { TOrganizationRole } from "@formbricks/types/memberships";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getTranslate } from "@/lingodotdev/server";
import { FeedbackRecordDirectoryTable } from "@/modules/ee/feedback-record-directory/components/feedback-record-directory-table";
import { getFeedbackRecordDirectories } from "@/modules/ee/feedback-record-directory/lib/feedback-record-directory";
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

  const [directories, orgWorkspaces] = await Promise.all([
    getFeedbackRecordDirectories(organizationId),
    getWorkspacesByOrganizationId(organizationId),
  ]);

  return (
    <SettingsCard
      title={t("environments.settings.feedback_record_directories.title")}
      description={t("environments.settings.feedback_record_directories.description")}>
      <FeedbackRecordDirectoryTable
        directories={directories}
        organizationId={organizationId}
        orgWorkspaces={orgWorkspaces}
        membershipRole={membershipRole}
      />
    </SettingsCard>
  );
};
