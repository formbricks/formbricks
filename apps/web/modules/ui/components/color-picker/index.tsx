"use client";

import { HexColorInput } from "react-colorful";
import { cn } from "@/lib/cn";
import { PopoverPicker } from "@/modules/ui/components/color-picker/components/popover-picker";

interface ColorPickerProps {
  color: string;
  onChange: (v: string) => void;
  containerClass?: string;
  disabled?: boolean;
}
export const ColorPicker = ({ color, onChange, containerClass, disabled = false }: ColorPickerProps) => {
  return (
    <div className={cn(containerClass)}>
      <div className="flex h-10 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-400">
        #
        <HexColorInput
          className="min-w-0 flex-1 border-0 bg-transparent text-slate-500 outline-none focus:border-none"
          color={color}
          onChange={onChange}
          id="color"
          aria-label="Primary color"
          disabled={disabled}
        />
        <PopoverPicker color={color} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
};
