import { cn } from "@/lib/cn";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";

interface AdvancedOptionToggleProps {
  isChecked: boolean;
  onToggle: (checked: boolean) => void;
  htmlId: string;
  title: string;
  description: any;
  children?: React.ReactNode;
  childBorder?: boolean;
  customContainerClass?: string;
  disabled?: boolean;
}

export const AdvancedOptionToggle = ({
  isChecked,
  onToggle,
  htmlId,
  title,
  description,
  children,
  childBorder,
  customContainerClass,
  disabled = false,
}: AdvancedOptionToggleProps) => {
  return (
    <div className={cn("px-4 py-2", customContainerClass)}>
      <div className="flex items-center space-x-1">
        <Switch id={htmlId} checked={isChecked} onCheckedChange={onToggle} disabled={disabled} />
        <Label htmlFor={htmlId} className="cursor-pointer rounded-l-lg">
          <div className="ml-2">
            <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
            <p className="text-xs font-normal text-slate-500">{description}</p>
          </div>
        </Label>
      </div>
      {children && isChecked && (
        <div
          className={`mt-4 flex w-full items-center space-x-1 rounded-lg ${
            childBorder ? "border" : ""
          } bg-slate-50`}>
          {children}
        </div>
      )}
    </div>
  );
};
