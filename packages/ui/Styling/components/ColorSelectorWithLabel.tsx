import { cn } from "@formbricks/lib/cn";

import { ColorPicker } from "../../ColorPicker";

type ColorSelectorWithLabelProps = {
  color: string;
  setColor: (color: string) => void;
  className?: string;
  disabled?: boolean;
};

export const ColorSelector = ({
  color,
  setColor,
  className = "",
  disabled = false,
}: ColorSelectorWithLabelProps) => {
  return (
    <div className={cn("max-w-xs", disabled ? "opacity-40" : "", className)}>
      <ColorPicker color={color} onChange={setColor} containerClass="my-0" disabled={disabled} />
    </div>
  );
};
