"use client";

import { FormControl, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";

interface NumberFieldProps {
  form: any;
  name: string;
  label: string;
  step?: number;
  max?: number;
  placeholder?: string;
}

export const NumberField = ({ form, name, label, step = 1, max, placeholder }: NumberFieldProps) => (
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
            onChange={(e) => {
              const val = e.target.valueAsNumber;
              field.onChange(Number.isNaN(val) ? null : val);
            }}
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
