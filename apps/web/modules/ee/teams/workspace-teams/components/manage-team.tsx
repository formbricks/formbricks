"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { Button } from "@/modules/ui/components/button";

export const ManageTeam = () => {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();

  const router = useRouter();

  const handleManageTeams = () => {
    router.push(`/organizations/${workspace?.organizationId}/settings/teams`);
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleManageTeams}>
      {t("workspace.teams.manage_teams")}
    </Button>
  );
};
