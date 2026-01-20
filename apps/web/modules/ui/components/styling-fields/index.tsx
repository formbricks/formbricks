"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import React from "react";
import { ColorPicker } from "@/modules/ui/components/color-picker";
import { FormControl, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";

export const StylingSection = ({
  title,
  open,
  setOpen,
  children,
}: {
  title: string;
  open: boolean;
  setOpen: (o: boolean) => void;
  children: React.ReactNode;
}) => {
  const [parent] = useAutoAnimate();

  return (
    <div ref={parent} className="rounded-md border">
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

export const ColorField = ({
  form,
  name,
  label,
  containerClass,
}: {
  form: any;
  name: string;
  label: string;
  containerClass?: string;
}) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem className="space-y-1">
        <FormLabel className="text-xs">{label}</FormLabel>
        <FormControl>
          <ColorPicker
            color={field.value}
            onChange={(color) => field.onChange(color)}
            containerClass={containerClass || "w-full"}
          />
        </FormControl>
      </FormItem>
    )}
  />
);

export const NumberField = ({
  form,
  name,
  label,
  step = 1,
  max,
  placeholder,
}: {
  form: any;
  name: string;
  label: string;
  step?: number;
  max?: number;
  placeholder?: string;
}) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem className="space-y-1">
        <FormLabel className="text-xs">{label}</FormLabel>
        <FormControl>
          <Input
            type="number"
            {...field}
            onChange={(e) => field.onChange(e.target.valueAsNumber)}
            step={step}
            max={max}
            className="text-xs"
            placeholder={placeholder}
          />
        </FormControl>
      </FormItem>
    )}
  />
);

export const DimensionInput = ({
  form,
  name,
  label,
  placeholder,
}: {
  form: any;
  name: string;
  label: string;
  placeholder?: string;
}) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => {
      const value = field.value;
      let unit = "px";
      if (typeof value === "string") {
        if (value.endsWith("%")) unit = "%";
        else if (value.endsWith("rem")) unit = "rem";
        else if (value.endsWith("em")) unit = "em";
      }
      const numericValue = typeof value === "string" ? Number.parseFloat(value) : value;

      return (
        <FormItem className="space-y-1">
          <FormLabel className="text-xs">{label}</FormLabel>
          <FormControl>
            <div className="flex rounded-md shadow-xs">
              <Input
                type="number"
                value={numericValue ?? ""}
                onChange={(e) => {
                  const valStr = e.target.value;
                  if (valStr === "") {
                    field.onChange(null);
                    return;
                  }
                  const newVal = Number.parseFloat(valStr);
                  if (Number.isNaN(newVal)) {
                    return;
                  }
                  field.onChange(unit === "px" ? newVal : `${newVal}${unit}`);
                }}
                className="flex-1 rounded-r-none border-r-0 text-xs focus-visible:ring-0"
                placeholder={placeholder}
              />
              <select
                value={unit}
                onChange={(e) => {
                  const newUnit = e.target.value;
                  const currentVal = numericValue ?? 0;
                  if (newUnit === "px") {
                    field.onChange(currentVal);
                  } else {
                    field.onChange(`${currentVal}${newUnit}`);
                  }
                }}
                className="ring-offset-background placeholder:text-muted-foreground focus:border-brand-dark h-10 items-center justify-between rounded-r-md border border-slate-300 bg-white pr-8 pl-3 text-xs font-medium focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50">
                <option value="px">px</option>
                <option value="%">%</option>
                <option value="rem">rem</option>
                <option value="em">em</option>
              </select>
            </div>
          </FormControl>
        </FormItem>
      );
    }}
  />
);

export const TextField = ({ form, name, label }: { form: any; name: string; label: string }) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem className="space-y-1">
        <FormLabel className="text-xs">{label}</FormLabel>
        <FormControl>
          <Input type="text" {...field} className="text-xs" />
        </FormControl>
      </FormItem>
    )}
  />
);
