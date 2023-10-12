import { Label } from "../Label";
import { Switch } from "../Switch";

interface AdvancedOptionToggleProps {
  isChecked: boolean;
  onToggle: (checked: boolean) => void;
  htmlId: string;
  title: string;
  description: any;
  children: React.ReactNode;
  childBorder?: boolean;
}

export function AdvancedOptionToggle({
  isChecked,
  onToggle,
  htmlId,
  title,
  description,
  children,
  childBorder,
}: AdvancedOptionToggleProps) {
  return (
    <div className="px-4 py-2">
      <div className="flex items-center space-x-1">
        <Switch id={htmlId} checked={isChecked} onCheckedChange={onToggle} />
        <Label htmlFor={htmlId} className="cursor-pointer">
          <div className="ml-2">
            <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
            <p className="text-xs font-normal text-slate-500">{description}</p>
          </div>
        </Label>
      </div>
      {isChecked && (
        <div
          className={`mt-4 flex w-full items-center space-x-1 rounded-lg ${
            childBorder ? "border" : ""
          } bg-slate-50`}>
          {children}
        </div>
      )}
    </div>
  );
}
