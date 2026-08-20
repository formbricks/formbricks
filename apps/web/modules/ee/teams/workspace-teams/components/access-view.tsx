"use client";

import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { AccessTable } from "@/modules/ee/teams/workspace-teams/components/access-table";
import { ManageTeam } from "@/modules/ee/teams/workspace-teams/components/manage-team";
import { TWorkspaceTeam } from "@/modules/ee/teams/workspace-teams/types/team";

interface AccessViewProps {
  teams: TWorkspaceTeam[];
}

export const AccessView = ({ teams }: AccessViewProps) => {
  const { t } = useTranslation();
  return (
    <>
      <SettingsCard
        title={t("common.team_access")}
        description={t("workspace.teams.team_settings_description")}
        bodyVariant="flush">
        {/* The table is edge-to-edge, so the control above it carries the card's gutter itself. */}
        <div className="mb-4 flex justify-end px-4 pt-4">
          <ManageTeam />
        </div>
        <AccessTable teams={teams} />
      </SettingsCard>
    </>
  );
};
