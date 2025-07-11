"use client";

import { cn } from "@/lib/cn";
import { VariantProps, cva } from "class-variance-authority";
import { AlertCircle, AlertTriangle, CheckCircle2Icon, Info } from "lucide-react";
import * as React from "react";
import { createContext, useContext } from "react";
import { Button, ButtonProps } from "../button";

// Create a context to share variant and size with child components
interface AlertContextValue {
  variant?: "default" | "error" | "warning" | "info" | "success" | null;
  size?: "default" | "small" | null;
}

const AlertContext = createContext<AlertContextValue>({
  variant: "default",
  size: "default",
});

const useAlertContext = () => useContext(AlertContext);

// Define alert styles with variants
const alertVariants = cva("relative w-full rounded-lg border [&>svg]:size-4", {
  variants: {
    variant: {
      default: "text-foreground border-border",
      error:
        "text-error-foreground [&>svg]:text-error border-error/50 [&_button]:bg-error-background [&_button]:text-error-foreground [&_button:hover]:bg-error-background-muted [&_a]:bg-error-background [&_a]:text-error-foreground [&_a:hover]:bg-error-background-muted",
      warning:
        "text-warning-foreground [&>svg]:text-warning border-warning/50 [&_button]:bg-warning-background [&_button]:text-warning-foreground [&_button:hover]:bg-warning-background-muted [&_a]:bg-warning-background [&_a]:text-warning-foreground [&_a:hover]:bg-warning-background-muted",
      info: "text-info-foreground [&>svg]:text-info border-info/50 [&_button]:bg-info-background [&_button]:text-info-foreground [&_button:hover]:bg-info-background-muted [&_a]:bg-info-background [&_a]:text-info-foreground [&_a:hover]:bg-info-background-muted",
      success:
        "text-success-foreground [&>svg]:text-success border-success/50 [&_button]:bg-success-background [&_button]:text-success-foreground [&_button:hover]:bg-success-background-muted [&_a]:bg-success-background [&_a]:text-success-foreground [&_a:hover]:bg-success-background-muted",
    },
    size: {
      default:
        "py-3 px-4 text-sm grid grid-cols-[2fr_auto] grid-rows-[auto_auto] gap-y-0.5 gap-x-3 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7",
      small:
        "px-4 py-2 text-xs flex items-center gap-2 [&>svg]:flex-shrink-0 [&_button]:bg-transparent [&_button:hover]:bg-transparent [&>svg~*]:pl-0",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

const alertVariantIcons: Record<"default" | "error" | "warning" | "info" | "success", React.ReactNode> = {
  default: null,
  error: <AlertCircle className="size-4" />,
  warning: <AlertTriangle className="size-4" />,
  info: <Info className="size-4" />,
  success: <CheckCircle2Icon className="size-4" />,
};

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, size, ...props }, ref) => {
  const variantIcon = variant && variant !== "default" ? alertVariantIcons[variant] : null;

  return (
    <AlertContext.Provider value={{ variant, size }}>
      <div ref={ref} role="alert" className={cn(alertVariants({ variant, size }), className)} {...props}>
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
          "col-start-1 row-start-1 font-medium tracking-tight",
          size === "small" ? "flex-shrink truncate" : "col-start-1 row-start-1",
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
          size === "small" ? "flex-shrink flex-grow-0 truncate" : "col-start-1 row-start-2",
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

    return (
      <div
        className={cn(
          "self-end",
          alertSize === "small"
            ? "-my-2 -mr-4 ml-auto flex-shrink-0"
            : "col-start-2 row-span-2 row-start-1 flex items-center justify-center"
        )}>
        <Button ref={ref} variant={buttonVariant} size={buttonSize} className={className} {...props}>
          {children}
        </Button>
      </div>
    );
  }
);

AlertButton.displayName = "AlertButton";

// Export the new component
export { Alert, AlertTitle, AlertDescription, AlertButton };
