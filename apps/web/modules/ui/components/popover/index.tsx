"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";
import { cn } from "@formbricks/lib/cn";

const Popover: React.FC<React.ComponentProps<typeof PopoverPrimitive.Root>> = PopoverPrimitive.Root;

const PopoverTrigger: React.FC<React.ComponentProps<typeof PopoverPrimitive.Trigger>> =
  PopoverPrimitive.Trigger;

const PopoverContent: React.ForwardRefExoticComponent<
  React.PropsWithoutRef<React.ComponentProps<typeof PopoverPrimitive.Content>> &
    React.RefAttributes<React.ElementRef<typeof PopoverPrimitive.Content>>
> = React.forwardRef(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "animate-in data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[side=right]:slide-in-from-left-2 data-[side=left]:slide-in-from-right-2 z-50 w-72 rounded-md border border-slate-100 bg-white p-4 shadow-md outline-hidden",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
