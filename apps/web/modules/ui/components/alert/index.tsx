"use client";

import { VariantProps, cva } from "class-variance-authority";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  ArrowUpRightIcon,
  CheckCircle2Icon,
  InfoIcon,
} from "lucide-react";
import * as React from "react";
import { createContext, useContext, useMemo } from "react";
import { cn } from "@/lib/cn";
import { Button, ButtonProps } from "../button";

// Create a context to share variant and size with child components
interface AlertContextValue {
  variant?: "default" | "error" | "warning" | "info" | "success" | "outbound" | null;
  size?: "default" | "small" | null;
}

const AlertContext = createContext<AlertContextValue>({
  variant: "default",
  size: "default",
});

const useAlertContext = () => useContext(AlertContext);

// Define alert styles with variants
const alertVariants = cva("relative w-full rounded-lg border bg-white [&>svg]:size-4", {
  variants: {
    variant: {
      default: "text-foreground border-border",
      outbound: "text-foreground border-border",
      error:
        "border-error/50 text-error-foreground [&_a]:bg-error-background [&_a]:text-error-foreground [&_a:hover]:bg-error-background-muted [&_button]:bg-error-background [&_button]:text-error-foreground [&_button:hover]:bg-error-background-muted [&>svg]:text-error",
      warning:
        "border-warning/50 text-warning-foreground [&_a]:bg-warning-background [&_a]:text-warning-foreground [&_a:hover]:bg-warning-background-muted [&_button]:bg-warning-background [&_button]:text-warning-foreground [&_button:hover]:bg-warning-background-muted [&>svg]:text-warning",
      info: "border-info/50 text-info-foreground [&_a]:bg-info-background [&_a]:text-info-foreground [&_a:hover]:bg-info-background-muted [&_button]:bg-info-background [&_button]:text-info-foreground [&_button:hover]:bg-info-background-muted [&>svg]:text-info",
      success:
        "border-success/50 text-success-foreground [&_a]:bg-success-background [&_a]:text-success-foreground [&_a:hover]:bg-success-background-muted [&_button]:bg-success-background [&_button]:text-success-foreground [&_button:hover]:bg-success-background-muted [&>svg]:text-success",
    },
    size: {
      default:
        "grid grid-cols-[2fr_auto] grid-rows-[auto_auto] gap-x-3 gap-y-0.5 px-4 py-3 text-sm [&>svg]:absolute [&>svg]:top-4 [&>svg]:left-4 [&>svg~*]:pl-7",
      small:
        "flex items-center gap-2 px-4 py-2 text-xs [&_a]:bg-transparent [&_a:hover]:bg-transparent [&_button]:bg-transparent [&_button:hover]:bg-transparent [&>svg]:shrink-0 [&>svg~*]:pl-0",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

const alertVariantIcons: Record<
  "default" | "error" | "warning" | "info" | "success" | "outbound",
  React.ReactNode
> = {
  default: null,
  outbound: <ArrowUpRightIcon className="size-4" />,
  error: <AlertCircleIcon className="size-4" />,
  warning: <AlertTriangleIcon className="size-4" />,
  info: <InfoIcon className="size-4" />,
  success: <CheckCircle2Icon className="size-4" />,
};

const Alert = React.forwardRef<
  HTMLDivElement,
  Readonly<React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>>
>(({ className, variant, size, role = "alert", ...props }, ref) => {
  const variantIcon = variant && variant !== "default" ? alertVariantIcons[variant] : null;

  const contextValue = useMemo(() => ({ variant, size }), [variant, size]);

  return (
    <AlertContext.Provider value={contextValue}>
      {/* role="alert" is an assertive live region and belongs on alerts that appear dynamically
          (e.g. validation or request errors). For banners already visible on first paint, pass
          role="status" so screen readers don't spuriously announce them on mount. */}
      <div ref={ref} role={role} className={cn(alertVariants({ variant, size }), className)} {...props}>
        {variantIcon}
        {props.children}
      </div>
    </AlertContext.Provider>
  );
});
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => {
    const { size } = useAlertContext();

    const headingContent = children || <span className="sr-only">Alert</span>;

    return (
      <h5
        ref={ref}
        className={cn(
          "col-start-1 row-start-1 tracking-tight",
          size === "small" ? "shrink truncate font-normal" : "col-start-1 row-start-1 font-medium",
          className
        )}
        {...props}>
        {headingContent}
      </h5>
    );
  }
);

AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    const { size } = useAlertContext();

    return (
      <div
        ref={ref}
        className={cn(
          "[&_p]:leading-relaxed",
          size === "small" ? "shrink grow-0 truncate" : "col-start-1 row-start-2",
          className
        )}
        {...props}
      />
    );
  }
);
AlertDescription.displayName = "AlertDescription";

const AlertButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => {
    const { size: alertSize } = useAlertContext();

    // Determine button styling based on alert context
    const buttonVariant = variant ?? (alertSize === "small" ? "link" : "secondary");
    const buttonSize = size ?? (alertSize === "small" ? "sm" : "default");
    const isSmallLinkButton = alertSize === "small" && buttonVariant === "link";

    return (
      <div
        className={cn(
          "self-end",
          alertSize === "small"
            ? "-my-2 -mr-4 ml-auto shrink-0"
            : "col-start-2 row-span-2 row-start-1 flex items-center justify-center"
        )}>
        <Button
          ref={ref}
          variant={buttonVariant}
          size={buttonSize}
          className={cn(
            isSmallLinkButton &&
              "bg-transparent font-normal underline-offset-4 hover:bg-transparent hover:underline",
            className
          )}
          {...props}>
          {children}
        </Button>
      </div>
    );
  }
);

AlertButton.displayName = "AlertButton";

// Export the new component
export { Alert, AlertButton, AlertDescription, AlertTitle };
