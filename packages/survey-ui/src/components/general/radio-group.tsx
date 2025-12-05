"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { AlertCircle, CircleIcon } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils";

function RadioGroup({
  className,
  errorMessage,
  dir,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root> & {
  errorMessage?: string;
  dir?: "ltr" | "rtl";
}): React.JSX.Element {
  return (
    <div className="flex gap-2" dir={dir}>
      {errorMessage ? <div className="bg-destructive min-h-full w-1" /> : null}
      <div className="space-y-2">
        {errorMessage ? (
          <div className="text-destructive flex items-center gap-1 text-sm">
            <AlertCircle className="size-4" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
        <RadioGroupPrimitive.Root
          aria-invalid={Boolean(errorMessage)}
          data-slot="radio-group"
          dir={dir}
          className={cn("grid gap-3", className)}
          {...props}
        />
      </div>
    </div>
  );
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>): React.JSX.Element {
  return (
    <RadioGroupPrimitive.Item
      style={{
        borderColor: "var(--fb-input-border-color, currentColor)",
        color: "var(--fb-input-color, currentColor)",
      }}
      data-slot="radio-group-item"
      className={cn(
        "border-primary text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 shadow-xs aspect-square size-4 shrink-0 rounded-full border bg-white outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}>
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center">
        <CircleIcon
          style={{ fill: "var(--fb-input-color, currentColor)" }}
          className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2"
        />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
