import { LucideIcon } from "lucide-react";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { Button } from "../button";

interface IconAction {
  icon: LucideIcon;
  tooltip: string;
  onClick?: () => void;
  isVisible?: boolean;
  disabled?: boolean;
  iconClassName?: string;
}

interface IconBarProps {
  actions: IconAction[];
  className?: string;
}

export const IconBar = ({ actions }: IconBarProps) => {
  const visibleActions = actions.filter((action) => action.isVisible);

  if (visibleActions.length === 0) return null;

  return (
    <div
      className="flex items-center justify-center divide-x rounded-md border border-slate-300 bg-white"
      role="toolbar"
      aria-label="Action buttons">
      {visibleActions.map((action, index) => (
        <span key={`${action.tooltip}-${index}`}>
          <TooltipRenderer tooltipContent={action.tooltip}>
            <Button
              variant="ghost"
              className="border-none hover:bg-slate-50"
              size="icon"
              onClick={action.onClick}
              disabled={action.disabled}
              aria-label={action.tooltip}>
              <action.icon className={action.iconClassName} />
            </Button>
          </TooltipRenderer>
        </span>
      ))}
    </div>
  );
};
