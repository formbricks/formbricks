import { useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";

interface PopoverPickerProps {
  color: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export const PopoverPicker = ({ color, onChange, disabled = false }: PopoverPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={disabled ? undefined : setIsOpen}>
      <PopoverTrigger asChild>
        <button
          id="color-picker"
          type="button"
          className="h-6 w-10 shrink-0 cursor-pointer rounded border border-slate-200"
          style={{ backgroundColor: color, opacity: disabled ? 0.5 : 1 }}
          onClick={(e) => {
            e.preventDefault();
            if (!disabled) {
              setIsOpen((prev) => !prev);
            }
          }}
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-2">
        <HexColorPicker color={color} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
};
