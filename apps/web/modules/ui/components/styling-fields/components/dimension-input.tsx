"use client";

import { FormControl, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";

interface DimensionInputProps {
  form: any;
  name: string;
  label: string;
  placeholder?: string;
}

export const DimensionInput = ({ form, name, label, placeholder }: DimensionInputProps) => (
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
                {...field}
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
