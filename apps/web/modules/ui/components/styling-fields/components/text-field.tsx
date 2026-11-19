"use client";

import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import type { TStylingFieldPath, TStylingForm } from "@/modules/ui/components/styling-fields/types";

interface TextFieldProps {
  readonly form: TStylingForm;
  readonly name: TStylingFieldPath<string | null | undefined>;
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
          {/* An unset field stays uncontrolled, as it was with `null`. */}
          <Input type="text" {...field} value={field.value ?? undefined} />
        </FormControl>
      </FormItem>
    )}
  />
);
