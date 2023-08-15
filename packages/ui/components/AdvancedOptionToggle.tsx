import { Label } from "./Label";
import { Switch } from "./Switch";

interface AdvancedOptionToggleProps {
  isChecked: boolean;
  onToggle: (checked: boolean) => void;
  htmlId: string;
  title: string;
  description: any;
  children: React.ReactNode;
  className?: string;
}

export function AdvancedOptionToggle({
  isChecked,
  onToggle,
  htmlId,
  title,
  description,
  children,
  className,
}: AdvancedOptionToggleProps) {
  return (
    <div className={className}>
      <div className="flex items-center space-x-1">
        <Switch id={htmlId} checked={isChecked} onCheckedChange={onToggle} />
        <Label htmlFor={htmlId} className="cursor-pointer">
          <div className="ml-2">
            <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
            <p className="text-xs font-normal text-slate-500">{description}</p>
          </div>
        </Label>
      </div>
      {isChecked && <div className="ml-2 mt-4 flex items-center space-x-1 pb-4">{children}</div>}
    </div>
  );
}
