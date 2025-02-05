"use client";

import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";

interface ManageTeamButtonProps {
  onClick: () => void;
  disabled: boolean;
}

export const ManageTeamButton = ({ onClick, disabled }: ManageTeamButtonProps) => {
  const { t } = useTranslate();

  return (
    <TooltipRenderer
      shouldRender={disabled}
      tooltipContent={t("environments.settings.teams.manage_team_disabled")}>
      <Button size="sm" variant="secondary" disabled={disabled} onClick={onClick}>
        {t("environments.settings.teams.manage_team")}
      </Button>
    </TooltipRenderer>
  );
};
