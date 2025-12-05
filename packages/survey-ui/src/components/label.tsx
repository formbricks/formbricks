"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import * as React from "react";
import { cn } from "../lib/utils";

interface LabelProps extends React.ComponentProps<typeof LabelPrimitive.Root> {
  /** Label variant for different styling contexts */
  variant?: "default" | "headline" | "description";
}

function Label({ className, variant = "default", ...props }: LabelProps): React.JSX.Element {
  // Default styles driven by CSS variables based on variant
  const getCssVarStyles = (): React.CSSProperties => {
    if (variant === "headline") {
      return {
        fontFamily: "var(--fb-question-headline-font-family)",
        fontWeight: "var(--fb-question-headline-font-weight)" as React.CSSProperties["fontWeight"],
        fontSize: "var(--fb-question-headline-font-size)",
        color: "var(--fb-question-headline-color)",
        opacity: "var(--fb-question-headline-opacity)",
      };
    }

    if (variant === "description") {
      return {
        fontFamily: "var(--fb-question-description-font-family)",
        fontWeight: "var(--fb-question-description-font-weight)" as React.CSSProperties["fontWeight"],
        fontSize: "var(--fb-question-description-font-size)",
        color: "var(--fb-question-description-color)",
        opacity: "var(--fb-question-description-opacity)",
      };
    }

    // Default variant styles
    return {
      fontFamily: "var(--fb-label-font-family)",
      fontWeight: "var(--fb-label-font-weight)" as React.CSSProperties["fontWeight"],
      fontSize: "var(--fb-label-font-size)",
      color: "var(--fb-label-color)",
      opacity: "var(--fb-label-opacity)",
    };
  };

  const cssVarStyles = getCssVarStyles();

  return (
    <LabelPrimitive.Root
      data-slot="label"
      data-variant={variant}
      className={cn(
        "flex select-none items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        className
      )}
      style={cssVarStyles}
      {...props}
    />
  );
}

export { Label };
export type { LabelProps };
