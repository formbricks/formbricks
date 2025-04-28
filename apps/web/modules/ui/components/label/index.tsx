"use client";

import { cn } from "@/lib/cn";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as React from "react";

type LabelType = React.ForwardRefExoticComponent<
  React.PropsWithoutRef<React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>> &
    React.RefAttributes<React.ElementRef<typeof LabelPrimitive.Root>>
>;

const Label: LabelType = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-sm leading-none font-medium text-slate-800 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 disabled:opacity-70 dark:text-slate-400 dark:peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
