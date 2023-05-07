"use client";

/* import { persistForm, useForm } from "@/lib/forms"; */
import useClickOutside from "@formbricks/lib/useClickOutside";
import { useCallback, useRef, useState } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";

export const ColorPicker = ({ color, onChange }: { color: string; onChange: (v: string) => void }) => {
  return (
    <div className="my-2">
      <div className="flex w-full items-center justify-between space-x-1 rounded-md border border-slate-300 px-2 text-sm text-slate-400">
        <div>
          #
          <HexColorInput
            className="ml-2 mr-2 h-10 w-16 bg-transparent text-slate-500 outline-none focus:border-none"
            color={color}
            onChange={onChange}
          />
        </div>
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
    <div className="picker relative">
      <div
        className="h-6 w-10 cursor-pointer rounded"
        style={{ backgroundColor: color }}
        onClick={() => toggle(!isOpen)}
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
