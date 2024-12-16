import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslations } from "next-intl";

interface ManageTeamButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const ManageTeamButton = ({ onClick, disabled }: ManageTeamButtonProps) => {
  const t = useTranslations();

  const ManageButton = (
    <Button size="sm" variant="secondary" disabled={disabled} onClick={onClick}>
      {t("environments.settings.teams.manage_team")}
    </Button>
  );

  if (disabled) {
    return (
      <TooltipRenderer tooltipContent={t("environments.settings.teams.manage_team_disabled")}>
        {ManageButton}
      </TooltipRenderer>
    );
  }

  return ManageButton;
};
