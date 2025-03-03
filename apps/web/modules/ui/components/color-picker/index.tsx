"use client";

import { PopoverPicker } from "@/modules/ui/components/color-picker/components/popover-picker";
import { HexColorInput } from "react-colorful";
import { cn } from "@formbricks/lib/cn";

interface ColorPickerProps {
  color: string;
  onChange: (v: string) => void;
  containerClass?: string;
  disabled?: boolean;
}
export const ColorPicker = ({ color, onChange, containerClass, disabled = false }: ColorPickerProps) => {
  return (
    <div className={cn("my-2", containerClass)}>
      <div className="flex w-full items-center justify-between space-x-1 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-400">
        <div className="flex w-full items-center">
          #
          <HexColorInput
            className="ml-2 mr-2 h-10 w-32 flex-1 border-0 bg-transparent text-slate-500 outline-none focus:border-none"
            color={color}
            onChange={onChange}
            id="color"
            aria-label="Primary color"
            disabled={disabled}
          />
        </div>
        <PopoverPicker color={color} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
};
