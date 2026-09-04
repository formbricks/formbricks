import { LucideIcon } from "lucide-react";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { Button } from "../button";

interface IconAction {
  icon: LucideIcon | null;
  tooltip: string;
  /**
   * Single-key shortcut that runs the same action, shown as a key cap next to the tooltip label.
   * An icon on its own cannot advertise a shortcut, so this is the only place a user meets it.
   */
  shortcut?: string;
  onClick?: () => void;
  isVisible?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  iconClassName?: string;
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
      {visibleActions.map((action, index) => (
        <span key={`${action.tooltip}-${index}`}>
          <TooltipRenderer
            tooltipContent={
              action.shortcut ? (
                <span className="flex items-center gap-1.5">
                  {action.tooltip}
                  <kbd className="rounded border border-slate-200 bg-slate-100 px-1 font-mono text-xs text-slate-500">
                    {action.shortcut.toUpperCase()}
                  </kbd>
                </span>
              ) : (
                action.tooltip
              )
            }>
            <Button
              variant="ghost"
              className="border-none hover:bg-slate-50"
              size="icon"
              onClick={action.onClick}
              disabled={action.disabled}
              loading={action.isLoading}
              aria-keyshortcuts={action.shortcut}
              aria-label={action.tooltip}>
              {action.icon ? <action.icon className={action.iconClassName} /> : null}
            </Button>
          </TooltipRenderer>
        </span>
      ))}
    </div>
  );
};
