import { TOrganizationRole } from "@formbricks/types/memberships";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getTranslate } from "@/lingodotdev/server";
import { FeedbackRecordDirectoryTable } from "@/modules/ee/feedback-record-directory/components/feedback-record-directory-table";
import { getFeedbackRecordDirectories } from "@/modules/ee/feedback-record-directory/lib/feedback-record-directory";
import { getProjectsByOrganizationId } from "@/modules/ee/teams/team-list/lib/project";

interface FeedbackRecordDirectoryViewProps {
  organizationId: string;
  membershipRole: TOrganizationRole;
}

export const FeedbackRecordDirectoryView = async ({
  organizationId,
  membershipRole,
}: FeedbackRecordDirectoryViewProps) => {
  const t = await getTranslate();

  const [directories, orgProjects] = await Promise.all([
    getFeedbackRecordDirectories(organizationId),
    getProjectsByOrganizationId(organizationId),
  ]);

  return (
    <SettingsCard
      title={t("environments.settings.feedback_record_directories.title")}
      description={t("environments.settings.feedback_record_directories.description")}>
      <FeedbackRecordDirectoryTable
        directories={directories}
        organizationId={organizationId}
        orgProjects={orgProjects}
        membershipRole={membershipRole}
      />
    </SettingsCard>
  );
};
