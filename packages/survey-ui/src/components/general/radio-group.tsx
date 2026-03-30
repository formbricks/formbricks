import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { CircleIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

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
    <RadioGroupPrimitive.Root
      aria-invalid={Boolean(errorMessage)}
      data-slot="radio-group"
      dir={dir}
      className={className}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>): React.JSX.Element {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "border-input-border text-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 aspect-square size-4 shrink-0 rounded-full border bg-white shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}>
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex items-center justify-center">
        <CircleIcon className="fill-brand stroke-brand size-2" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
