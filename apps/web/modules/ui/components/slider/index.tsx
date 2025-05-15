"use client";

import { cn } from "@/lib/cn";
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

export const Slider: React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> &
    React.RefAttributes<React.ElementRef<typeof SliderPrimitive.Root>>
> = React.forwardRef(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}>
    <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-slate-300">
      <SliderPrimitive.Range className="absolute h-full bg-slate-300" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="border-primary ring-offset-background focus-visible:ring-ring block h-5 w-5 rounded-full border-2 bg-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;
