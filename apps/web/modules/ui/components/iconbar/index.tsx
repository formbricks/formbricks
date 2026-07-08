import { LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { Button } from "../button";

interface IconAction {
  icon: LucideIcon | null;
  tooltip: string;
  onClick?: () => void;
  isVisible?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  iconClassName?: string;
  // When provided, clicking the button opens a popover anchored to it instead of
  // (or in addition to) firing onClick. The open state is controlled by the
  // caller via popoverOpen/onPopoverOpenChange.
  popoverContent?: ReactNode;
  popoverOpen?: boolean;
  onPopoverOpenChange?: (open: boolean) => void;
  popoverAlign?: "start" | "center" | "end";
}

interface IconBarProps {
  actions: IconAction[];
}

export const IconBar = ({ actions }: IconBarProps) => {
  const visibleActions = actions.filter((action) => action.isVisible);

  if (visibleActions.length === 0) return null;

  return (
    <div
      className="flex items-center justify-center divide-x rounded-md border border-slate-300 bg-white"
      role="toolbar"
      aria-label="Action buttons">
      {visibleActions.map((action, index) => {
        const button = (
          <Button
            variant="ghost"
            className="border-none hover:bg-slate-50"
            size="icon"
            onClick={action.onClick}
            disabled={action.disabled}
            loading={action.isLoading}
            aria-label={action.tooltip}>
            {action.icon ? <action.icon className={action.iconClassName} /> : null}
          </Button>
        );

        return (
          <span key={`${action.tooltip}-${index}`}>
            {action.popoverContent ? (
              <Popover open={action.popoverOpen} onOpenChange={action.onPopoverOpenChange}>
                {/* Suppress the tooltip while the popover is open so the two don't overlap. */}
                <TooltipRenderer tooltipContent={action.tooltip} shouldRender={!action.popoverOpen}>
                  <PopoverTrigger asChild>{button}</PopoverTrigger>
                </TooltipRenderer>
                <PopoverContent align={action.popoverAlign ?? "end"}>{action.popoverContent}</PopoverContent>
              </Popover>
            ) : (
              <TooltipRenderer tooltipContent={action.tooltip}>{button}</TooltipRenderer>
            )}
          </span>
        );
      })}
    </div>
  );
};
