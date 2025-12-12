"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";

interface ManageTeamProps {
  environmentId: string;
}

export const ManageTeam = ({ environmentId }: ManageTeamProps) => {
  const { t } = useTranslation();

  const router = useRouter();

  const handleManageTeams = () => {
    router.push(`/environments/${environmentId}/settings/teams`);
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleManageTeams}>
      {t("environments.project.teams.manage_teams")}
    </Button>
  );
};
