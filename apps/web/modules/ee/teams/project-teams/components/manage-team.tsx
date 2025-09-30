"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface ManageTeamProps {
  environmentId: string;
  isOwnerOrManager: boolean;
}

export const ManageTeam = ({ environmentId, isOwnerOrManager }: ManageTeamProps) => {
  const { t } = useTranslation();

  const router = useRouter();

  const handleManageTeams = () => {
    router.push(`/environments/${environmentId}/settings/teams`);
  };

  if (isOwnerOrManager) {
    return (
      <Button variant="secondary" size="sm" onClick={handleManageTeams}>
        {t("environments.project.teams.manage_teams")}
      </Button>
    );
  }

  return (
    <TooltipRenderer
      tooltipContent={t("environments.project.teams.only_organization_owners_and_managers_can_manage_teams")}>
      <Button variant="secondary" size="sm" disabled>
        {t("environments.project.teams.manage_teams")}
      </Button>
    </TooltipRenderer>
  );
};
