import { LucideIcon } from "lucide-react";
import { Button } from "../button";

interface IconAction {
  icon: LucideIcon;
  tooltip: string;
  onClick?: () => void;
  show?: boolean;
}

interface IconBarProps {
  actions: IconAction[];
  className?: string;
}

export const IconBar = ({ actions, className = "" }: IconBarProps) => {
  return (
    <div
      className={`flex items-center justify-center divide-x rounded-lg border border-slate-300 bg-white ${className}`}>
      {actions
        .filter((action) => action.show !== false)
        .map((action, index) => (
          <span key={index}>
            <Button
              variant="minimal"
              className="border-none hover:bg-slate-50"
              size="icon"
              StartIcon={action.icon}
              tooltip={action.tooltip}
              onClick={action.onClick}
            />
          </span>
        ))}
    </div>
  );
};
