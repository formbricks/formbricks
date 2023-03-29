"use client";

/* import { persistForm, useForm } from "@/lib/forms"; */
import useClickOutside from "@formbricks/lib/useClickOutside";
import { useCallback, useRef, useState } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";

export const ColorPicker = ({ color, onChange }: { color: string; onChange: (v: string) => void }) => {
  return (
    <div className="my-2">
      <div className="flex w-fit items-center space-x-1 rounded border px-2 text-slate-400">
        #
        <HexColorInput
          className="mr-2 ml-2 h-10 w-16 text-slate-500 outline-none focus:border-none"
          color={color}
          onChange={onChange}
        />
        <PopoverPicker color={color} onChange={onChange} />
      </div>
    </div>
  );
};

export const PopoverPicker = ({ color, onChange }: { color: string; onChange: (v: string) => void }) => {
  const popover = useRef(null);
  const [isOpen, toggle] = useState(false);

  const close = useCallback(() => toggle(false), []);
  useClickOutside(popover, close);

  return (
    <div className="picker">
      <div
        className="relative h-6 w-10 rounded"
        style={{ backgroundColor: color }}
        onClick={() => toggle(true)}
      />

      {isOpen && (
        <div className="absolute left-16 z-20 mt-1" ref={popover}>
          <HexColorPicker color={color} onChange={onChange} />
        </div>
      )}
    </div>
  );
};
