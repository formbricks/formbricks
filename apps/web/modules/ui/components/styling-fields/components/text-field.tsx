"use client";

import { FormControl, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";

interface TextFieldProps {
  form: any;
  name: string;
  label: string;
}

export const TextField = ({ form, name, label }: TextFieldProps) => (
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
