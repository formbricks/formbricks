"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import React from "react";

export { ColorField } from "./components/color-field";
export { DimensionInput } from "./components/dimension-input";
export { NumberField } from "./components/number-field";
export { TextField } from "./components/text-field";

interface StylingSectionProps {
  title: string;
  open: boolean;
  setOpen: (o: boolean) => void;
  children: React.ReactNode;
}

export const StylingSection = ({ title, open, setOpen, children }: StylingSectionProps) => {
  const [parent] = useAutoAnimate();

  return (
    <div ref={parent} className={`rounded-md border ${open ? "overflow-visible" : "overflow-hidden"}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-t-md bg-slate-50 p-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
        {title}
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && <div className="rounded-b-md border-t bg-white p-4">{children}</div>}
    </div>
  );
};
