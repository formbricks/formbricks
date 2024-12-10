import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "@formbricks/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        success: "bg-emerald-100 border-emerald-200 text-emerald-800",
        warning: "bg-amber-100 border-amber-200 text-amber-800",
        error: "bg-red-100 border-red-200 text-red-800",
        gray: "bg-slate-100 border-slate-200 text-slate-600",
        black: "bg-slate-900 border-slate-900 text-slate-50",
      },
      size: {
        tiny: "px-1.5 py-0.5 text-xs",
        normal: "px-2.5 py-0.5 text-xs",
        large: "px-3.5 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "gray",
      size: "normal",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
