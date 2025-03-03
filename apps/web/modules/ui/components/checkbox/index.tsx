"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "@formbricks/lib/cn";

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxPrimitive.CheckboxProps>(
  ({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref as React.Ref<HTMLButtonElement>}
      className={cn(
        "peer h-5 w-5 shrink-0 rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-600 dark:focus:ring-slate-400 dark:focus:ring-offset-slate-900",
        className
      )}
      {...props}>
      <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center")}>
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
);
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
