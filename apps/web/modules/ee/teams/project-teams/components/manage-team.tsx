"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface ManageTeamProps {
  environmentId: string;
  canManageTeams: boolean;
}

export const ManageTeam = ({ environmentId, canManageTeams }: ManageTeamProps) => {
  const { t } = useTranslation();

  const router = useRouter();

  const handleManageTeams = () => {
    router.push(`/environments/${environmentId}/settings/teams`);
  };

  if (canManageTeams) {
    return (
      <Button variant="secondary" size="sm" onClick={handleManageTeams}>
        {t("environments.project.teams.manage_teams")}
      </Button>
    );
  }

  return (
    <TooltipRenderer tooltipContent={t("environments.settings.teams.manage_team_disabled")}>
      <Button variant="secondary" size="sm" disabled>
        {t("environments.project.teams.manage_teams")}
      </Button>
    </TooltipRenderer>
  );
};
