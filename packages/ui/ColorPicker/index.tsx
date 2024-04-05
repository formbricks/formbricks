"use client";

import { useCallback, useRef, useState } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";

import { cn } from "@formbricks/lib/cn";
import { useClickOutside } from "@formbricks/lib/utils/hooks/useClickOutside";

export const ColorPicker = ({
  color,
  onChange,
  containerClass,
  disabled = false,
}: {
  color: string;
  onChange: (v: string) => void;
  containerClass?: string;
  disabled?: boolean;
}) => {
  return (
    <div className={cn("my-2", containerClass)}>
      <div className="flex w-full items-center justify-between space-x-1 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-400">
        <div className="flex w-full items-center">
          #
          <HexColorInput
            className="ml-2 mr-2 h-10 w-32 flex-1 border-0 bg-transparent  text-slate-500 outline-none focus:border-none"
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

export const PopoverPicker = ({
  color,
  onChange,
  disabled = false,
}: {
  color: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) => {
  const popover = useRef(null);
  const [isOpen, toggle] = useState(false);

  const close = useCallback(() => toggle(false), []);
  useClickOutside(popover, close);

  return (
    <div className="picker relative">
      <div
        id="color-picker"
        className="h-6 w-10 cursor-pointer rounded border border-slate-200"
        style={{ backgroundColor: color, opacity: disabled ? 0.5 : 1 }}
        onClick={() => {
          if (!disabled) {
            toggle(!isOpen);
          }
        }}
      />

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 origin-top-right" ref={popover}>
          <div className="rounded bg-white p-2 shadow-lg">
            <HexColorPicker color={color} onChange={onChange} />
          </div>
        </div>
      )}
    </div>
  );
};
