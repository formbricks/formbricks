"use client";

import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";

interface TextFieldProps {
  readonly form: any;
  readonly name: string;
  readonly label: string;
  readonly description?: string;
}

export const TextField = ({ form, name, label, description }: TextFieldProps) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem className="space-y-1">
        <FormLabel>{label}</FormLabel>
        {description && <FormDescription>{description}</FormDescription>}
        <FormControl>
          <Input type="text" {...field} />
        </FormControl>
      </FormItem>
    )}
  />
);
