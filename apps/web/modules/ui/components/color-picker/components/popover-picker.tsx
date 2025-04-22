import { useClickOutside } from "@/lib/utils/hooks/useClickOutside";
import { useCallback, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";

interface PopoverPickerProps {
  color: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export const PopoverPicker = ({ color, onChange, disabled = false }: PopoverPickerProps) => {
  const popover = useRef(null);
  const [isOpen, toggle] = useState(false);

  const close = useCallback(() => toggle(false), []);
  useClickOutside(popover, close);

  return (
    <div className="picker relative">
      <div
        id="color-picker"
        className="h-6 w-10 cursor-pointer rounded-sm border border-slate-200"
        style={{ backgroundColor: color, opacity: disabled ? 0.5 : 1 }}
        onClick={() => {
          if (!disabled) {
            toggle(!isOpen);
          }
        }}
      />

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 origin-top-right" ref={popover}>
          <div className="rounded-sm bg-white p-2 shadow-lg">
            <HexColorPicker color={color} onChange={onChange} />
          </div>
        </div>
      )}
    </div>
  );
};
