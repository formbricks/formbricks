import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { Button } from "../button";

interface IconAction {
  icon: LucideIcon | null;
  tooltip: string;
  /**
   * Single-key shortcut that runs the same action, shown as a key cap on the button itself. On the
   * tooltip alone it only reaches someone already hovering the icon they were looking for, which is
   * exactly the user who does not need it - so it sits in the bar, visible without interaction.
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
          <TooltipRenderer tooltipContent={action.tooltip}>
            <Button
              variant="ghost"
              className={cn("border-none hover:bg-slate-50", action.shortcut && "w-auto gap-1.5 px-2.5")}
              size="icon"
              onClick={action.onClick}
              disabled={action.disabled}
              loading={action.isLoading}
              aria-keyshortcuts={action.shortcut}
              aria-label={action.tooltip}>
              {action.icon ? <action.icon className={action.iconClassName} /> : null}
              {action.shortcut ? (
                // Hidden from the accessible name, which `aria-label` owns; `aria-keyshortcuts`
                // above is what announces the shortcut itself.
                <kbd
                  aria-hidden="true"
                  className="rounded border border-slate-200 bg-slate-100 px-1.5 py-1 font-mono text-xs leading-none font-semibold text-slate-600">
                  {action.shortcut.toUpperCase()}
                </kbd>
              ) : null}
            </Button>
          </TooltipRenderer>
        </span>
      ))}
    </div>
  );
};
