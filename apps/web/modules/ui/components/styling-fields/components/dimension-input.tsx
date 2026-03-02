"use client";

import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface DimensionInputProps {
  form: any;
  name: string;
  label: string;
  placeholder?: string;
  description?: string;
}

const UNITS = ["px", "%", "rem", "em"] as const;

export const DimensionInput = ({ form, name, label, description, placeholder }: DimensionInputProps) => (
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
      const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
      const numericValue = typeof parsed === "number" && Number.isNaN(parsed) ? null : parsed;

      return (
        <FormItem className="space-y-1">
          <FormLabel>{label}</FormLabel>
          {description && <FormDescription>{description}</FormDescription>}
          <FormControl>
            <div className="focus-within:border-brand-dark flex h-10 rounded-md border border-slate-300 focus-within:ring-2 focus-within:ring-slate-400 focus-within:ring-offset-2">
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
                placeholder={placeholder}
                className="flex-1 rounded-r-none border-0 shadow-none focus:ring-0 focus:ring-offset-0"
              />
              <Select
                value={unit}
                onValueChange={(newUnit) => {
                  const currentVal = numericValue ?? 0;
                  if (newUnit === "px") {
                    field.onChange(currentVal);
                  } else {
                    field.onChange(`${currentVal}${newUnit}`);
                  }
                }}>
                <SelectTrigger className="h-full w-[70px] rounded-l-none border-0 border-l border-slate-300 text-sm font-medium shadow-none focus:ring-0 focus:ring-offset-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u} className="text-sm">
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FormControl>
        </FormItem>
      );
    }}
  />
);
