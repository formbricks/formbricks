"use client";

import { ColorPicker } from "@/modules/ui/components/color-picker";
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";

interface ColorFieldProps {
  form: any;
  name: string;
  label: string;
  description?: string;
  containerClass?: string;
}

export const ColorField = ({ form, name, label, description, containerClass }: ColorFieldProps) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem className="space-y-1">
        <FormLabel>{label}</FormLabel>
        {description && <FormDescription>{description}</FormDescription>}
        <FormControl>
          <ColorPicker
            color={field.value ?? ""}
            onChange={(color) => field.onChange(color)}
            containerClass={containerClass || "w-full"}
          />
        </FormControl>
      </FormItem>
    )}
  />
);
