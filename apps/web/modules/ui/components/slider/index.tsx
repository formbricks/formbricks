"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";
import { cn } from "@/lib/cn";

export const Slider: React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    // The thumb carries role="slider", so it is what needs the accessible name; a label on Root names
    // nothing a screen reader announces.
    thumbAriaLabel?: string;
  } & React.RefAttributes<React.ElementRef<typeof SliderPrimitive.Root>>
> = React.forwardRef(({ className, thumbAriaLabel, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none items-center select-none", className)}
    {...props}>
    <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-slate-300">
      <SliderPrimitive.Range className="absolute h-full bg-slate-300" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      aria-label={thumbAriaLabel}
      className="ring-offset-background focus-visible:ring-ring block size-5 rounded-full border-2 border-primary bg-slate-900 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;
