import { cn } from "@formbricks/lib/cn";

import { ColorPicker } from "../ColorPicker";

type ColorSelectorWithLabelProps = {
  label: string;
  description?: string;
  color: string;
  setColor: React.Dispatch<React.SetStateAction<string>>;
  className?: string;
  disabled?: boolean;
};

const ColorSelectorWithLabel = ({
  color,
  description = "",
  label,
  setColor,
  className = "",
  disabled = false,
}: ColorSelectorWithLabelProps) => {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col">
        <h3 className="text-base font-semibold text-slate-900">{label}</h3>
        {description && <p className="text-sm text-slate-800">{description}</p>}
      </div>

      <ColorPicker color={color} onChange={setColor} containerClass="my-0" disabled={disabled} />
    </div>
  );
};

export default ColorSelectorWithLabel;
