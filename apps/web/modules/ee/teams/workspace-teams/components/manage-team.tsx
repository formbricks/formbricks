"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/environment-context";
import { Button } from "@/modules/ui/components/button";

export const ManageTeam = () => {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const workspaceBasePath = `/workspaces/${workspace?.id}`;

  const router = useRouter();

  const handleManageTeams = () => {
    router.push(`${workspaceBasePath}/settings/teams`);
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleManageTeams}>
      {t("environments.workspace.teams.manage_teams")}
    </Button>
  );
};
