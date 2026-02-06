"use client";

import { ColorPicker } from "@/modules/ui/components/color-picker";
import { FormControl, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";

interface ColorFieldProps {
  form: any;
  name: string;
  label: string;
  containerClass?: string;
}

export const ColorField = ({ form, name, label, containerClass }: ColorFieldProps) => (
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
