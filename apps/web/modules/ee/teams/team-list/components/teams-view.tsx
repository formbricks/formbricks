import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { TeamsTable } from "@/modules/ee/teams/team-list/components/teams-table";
import { getProjectsByOrganizationId } from "@/modules/ee/teams/team-list/lib/project";
import { getTeams } from "@/modules/ee/teams/team-list/lib/team";
import { getMembersByOrganizationId } from "@/modules/organization/settings/teams/lib/membership";
import { ModalButton, UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getTranslate } from "@/tolgee/server";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface TeamsViewProps {
  organizationId: string;
  membershipRole?: TOrganizationRole;
  currentUserId: string;
  canDoRoleManagement: boolean;
  environmentId: string;
}

export const TeamsView = async ({
  organizationId,
  membershipRole,
  currentUserId,
  canDoRoleManagement,
  environmentId,
}: TeamsViewProps) => {
  const t = await getTranslate();

  const [teams, orgMembers, orgProjects] = await Promise.all([
    getTeams(currentUserId, organizationId),
    getMembersByOrganizationId(organizationId),
    getProjectsByOrganizationId(organizationId),
  ]);

  if (!teams) {
    throw new Error(t("common.teams_not_found"));
  }

  const buttons: [ModalButton, ModalButton] = [
    {
      text: IS_FORMBRICKS_CLOUD ? t("common.start_free_trial") : t("common.request_trial_license"),
      href: IS_FORMBRICKS_CLOUD
        ? `/environments/${environmentId}/settings/billing`
        : "https://formbricks.com/docs/self-hosting/license#30-day-trial-license-request",
    },
    {
      text: t("common.learn_more"),
      href: "https://formbricks.com/docs/self-hosting/license",
    },
  ];

  return (
    <SettingsCard
      title={t("environments.settings.teams.teams")}
      description={t("environments.settings.teams.teams_description")}>
      {canDoRoleManagement ? (
        <TeamsTable
          teams={teams}
          membershipRole={membershipRole}
          organizationId={organizationId}
          orgMembers={orgMembers}
          orgProjects={orgProjects}
          currentUserId={currentUserId}
        />
      ) : (
        <UpgradePrompt
          title={t("environments.settings.teams.unlock_teams_title")}
          description={t("environments.settings.teams.unlock_teams_description")}
          buttons={buttons}
        />
      )}
    </SettingsCard>
  );
};
