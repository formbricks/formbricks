import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { LucideIcon } from "lucide-react";
import { Button } from "../button";

interface IconAction {
  icon: LucideIcon;
  tooltip: string;
  onClick?: () => void;
  isVisible?: boolean;
}

interface IconBarProps {
  actions: IconAction[];
  className?: string;
}

export const IconBar = ({ actions }: IconBarProps) => {
  if (actions.length === 0) return null;

  return (
    <div
      className="flex items-center justify-center divide-x rounded-md border border-slate-300 bg-white"
      role="toolbar"
      aria-label="Action buttons">
      {actions
        .filter((action) => action.isVisible)
        .map((action, index) => (
          <span key={`${action.tooltip}-${index}`}>
            <TooltipRenderer tooltipContent={action.tooltip}>
              <Button
                variant="ghost"
                className="border-none hover:bg-slate-50"
                size="icon"
                onClick={action.onClick}
                aria-label={action.tooltip}>
                <action.icon />
              </Button>
            </TooltipRenderer>
          </span>
        ))}
    </div>
  );
};
