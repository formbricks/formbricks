import { VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "@formbricks/lib/cn";

const alertVariants = cva(
  "relative w-full rounded-xl border p-3 [&>svg]:absolute [&>svg]:text-foreground [&>svg]:left-3 [&>svg]:top-3 [&>svg+div]:translate-y-[-3px] [&:has(svg)]:pl-9",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "text-destructive border-destructive/50 dark:border-destructive [&>svg]:text-destructive text-destructive",
        info: "text-slate-800 bg-brand/5",
        warning: "text-yellow-700 bg-yellow-50",
        error: "border-error/50 dark:border-error [&>svg]:text-error text-error",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof alertVariants> & { dangerouslySetInnerHTML?: { __html: string } }
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement> & { dangerouslySetInnerHTML?: { __html: string } }
>(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn("mb-1 cursor-default font-medium leading-none", className)} {...props} />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement> & { dangerouslySetInnerHTML?: { __html: string } }
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("cursor-default text-sm [&_p]:leading-relaxed", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertDescription, AlertTitle };
