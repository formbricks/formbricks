import { cn } from "@formbricks/lib/cn";

import { ColorPicker } from "../../ColorPicker";
import { Label } from "../../Label";

type ColorSelectorWithLabelProps = {
  label: string;
  description?: string;
  color: string;
  setColor: (color: string) => void;
  className?: string;
  disabled?: boolean;
};

export const ColorSelectorWithLabel = ({
  color,
  description = "",
  label,
  setColor,
  className = "",
  disabled = false,
}: ColorSelectorWithLabelProps) => {
  return (
    <div className={cn("flex max-w-xs flex-col gap-4", disabled ? "opacity-40" : "", className)}>
      <div className="flex flex-col">
        <Label className="mr-2 text-sm font-semibold text-slate-700">{label}</Label>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>

      <ColorPicker color={color} onChange={setColor} containerClass="my-0" disabled={disabled} />
    </div>
  );
};
