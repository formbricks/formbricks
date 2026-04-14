"use client";

import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";

interface NumberFieldProps {
  form: any;
  name: string;
  label: string;
  description?: string;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
}

export const NumberField = ({
  form,
  name,
  label,
  description,
  placeholder,
  step = 1,
  min,
  max,
}: NumberFieldProps) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem className="space-y-1">
        <FormLabel>{label}</FormLabel>
        {description && <FormDescription>{description}</FormDescription>}
        <FormControl>
          <Input
            type="number"
            {...field}
            onChange={(e) => {
              const val = e.target.valueAsNumber;
              field.onChange(Number.isNaN(val) ? null : val);
            }}
            step={step}
            min={min}
            max={max}
            placeholder={placeholder}
          />
        </FormControl>
      </FormItem>
    )}
  />
);
