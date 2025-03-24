import { VariantProps, cva } from "class-variance-authority";
import { AlertCircle, AlertTriangle, CheckCircle2Icon, Info } from "lucide-react";
import * as React from "react";
import { cn } from "@formbricks/lib/cn";
import { Button, ButtonProps } from "../button";

// Create a context to share variant and size with child components
interface AlertContextValue {
  variant?: "default" | "error" | "warning" | "info" | "success" | null;
  size?: "default" | "small" | null;
}

const AlertContext = React.createContext<AlertContextValue>({
  variant: "default",
  size: "default",
});

const useAlertContext = () => React.useContext(AlertContext);

// Define alert styles with variants
const alertVariants = cva("relative w-full rounded-lg border", {
  variants: {
    variant: {
      default: "text-foreground border-border",
      error:
        "text-error-foreground border-error/50 [&_button]:bg-error-background [&_button]:text-error-foreground [&_button:hover]:bg-error-background-muted",
      warning:
        "text-warning-foreground border-warning/50 [&_button]:bg-warning-background [&_button]:text-warning-foreground [&_button:hover]:bg-warning-background-muted",
      info: "text-info-foreground border-info/50 [&_button]:bg-info-background [&_button]:text-info-foreground [&_button:hover]:bg-info-background-muted",
      success:
        "text-success-foreground border-success/50 [&_button]:bg-success-background [&_button]:text-success-foreground [&_button:hover]:bg-success-background-muted",
    },
    size: {
      default:
        "py-3 px-4 text-sm grid grid-cols-[1fr_auto] grid-rows-[auto_auto] gap-x-3 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
      small:
        "px-3 py-2 text-xs flex items-center gap-2 [&>svg]:flex [&_button]:text-xs [&_button]:bg-transparent [&_button:hover]:bg-transparent [&>svg~*]:pl-0 ",
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
  const variantIcon = variant ? (variant !== "default" ? alertVariantIcons[variant] : null) : null;

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
  ({ className, ...props }, ref) => {
    const { size } = useAlertContext();
    return (
      <h5
        ref={ref}
        className={cn(
          "col-start-1 row-start-1 font-medium leading-none tracking-tight",
          size === "small" ? "min-w-[200] truncate" : "col-start-1 row-start-1",

          className
        )}
        {...props}
      />
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
          // Add truncation and size-specific classes
          size === "small" ? "truncate" : "col-start-1 row-start-2",
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
    const { variant: alertVariant, size: alertSize } = useAlertContext();

    // Determine button styling based on alert context
    const buttonVariant = variant || (alertSize === "small" ? "link" : "secondary");
    const buttonSize = size || (alertSize === "small" ? "sm" : "default");

    return (
      <div
        className={cn(
          "self-end",
          alertSize === "small"
            ? "-my-2 -mr-3 ml-auto"
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
