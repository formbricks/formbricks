"use client";

import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";

interface NumberFieldProps {
  readonly form: any;
  readonly name: string;
  readonly label: string;
  readonly description?: string;
  readonly step?: number;
  readonly min?: number;
  readonly max?: number;
  readonly placeholder?: string;
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
