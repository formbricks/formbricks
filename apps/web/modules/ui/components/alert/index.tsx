import { VariantProps, cva } from "class-variance-authority";
import { AlertCircle, AlertTriangle, CheckCircle2Icon, Info } from "lucide-react";
import * as React from "react";
import { cn } from "@formbricks/lib/cn";

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
const alertVariants = cva("relative w-full rounded-lg border px-4 py-3 [&>svg+div]:translate-y-[-3px]", {
  variants: {
    variant: {
      default: "text-foreground border-border 80",
      error:
        "text-error-foreground border-error/50 [&_button]:bg-error-background [&_button]:text-error-foreground [&_button:hover]:bg-error-background-muted ",
      warning:
        "text-warning-foreground border-warning/50 [&_button]:bg-warning-background [&_button]:text-warning-foreground [&_button:hover]:bg-warning-background-muted",
      info: "text-info-foreground border-info/50 [&_button]:bg-info-background [&_button]:text-info-foreground [&_button:hover]:bg-info-background-muted",
      success:
        "text-success-foreground border-success/50 [&_button]:bg-success-background [&_button]:text-success-foreground [&_button:hover]:bg-success-background-muted",
    },
    size: {
      default:
        "py-3 px-4 text-sm  [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:w-4 [&>svg]:h-4 [&>svg]:text-foreground [&>svg~*]:pl-7", // Keep padding and text size in size variant
      small:
        "py-2 px-3 text-xs flex items-baseline gap-2 [&_button]:text-xs [&_button]:bg-transparent [&_button:hover]:bg-transparent", // Add flex for small size
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

const alertVariantIcons: Record<"default" | "error" | "warning" | "info" | "success", React.ReactNode> = {
  default: null,
  error: <AlertCircle className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
  success: <CheckCircle2Icon className="h-4 w-4" />,
};

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, size, ...props }, ref) => (
  <AlertContext.Provider value={{ variant, size }}>
    <div ref={ref} role="alert" className={cn(alertVariants({ variant, size }), className)} {...props} />
  </AlertContext.Provider>
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
  )
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("[&_p]:leading-relaxed", className)} {...props} />
  )
);
AlertDescription.displayName = "AlertDescription";

const AlertActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { variant, size } = useAlertContext();

    // Clone children and inject button type based on alert size
    const modifiedChildren = React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        // Only apply default type if child doesn't already have a type prop
        const childProps = {
          ...child.props,
          // Only set type if it's not already defined in child props
          ...(child.props.variant === undefined && {
            variant: size === "small" ? "link" : "secondary",
          }),
          ...(child.props.size === undefined && {
            size: size === "small" ? "sm" : "default",
          }),
        };
        return React.cloneElement(child, childProps);
      }
      return child;
    });

    return (
      <div
        ref={ref}
        className={cn(
          size === "small" ? "absolute bottom-0 right-0 ml-auto" : "absolute bottom-3 right-4",
          className
        )}
        {...props}>
        {modifiedChildren}
      </div>
    );
  }
);

AlertActions.displayName = "AlertActions";

// Export the new component
export { Alert, AlertTitle, AlertDescription, AlertActions };
