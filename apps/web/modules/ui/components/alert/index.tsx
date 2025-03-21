import { Button } from "@/modules/ui/components/button";
import { VariantProps, cva } from "class-variance-authority";
import { content } from "googleapis/build/src/apis/content";
import { AlertCircle, AlertTriangle, CheckCircle2Icon, Info } from "lucide-react";
import * as React from "react";
import { cn } from "@formbricks/lib/cn";

// Create a context to share Alert's variant and size with child components
const AlertContext = React.createContext<{
  variant: "default" | "error" | "warning" | "info" | "success";
  size: "default" | "small";
}>({
  variant: "default",
  size: "default",
});

// Define alert styles with variants
const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "text-foreground border-border 80",
        error: "text-error-foreground border-error/50 ",
        warning: "text-warning-foreground border-warning/50",
        info: "text-info-foreground border-info/50",
        success: "text-success-foreground border-success/50",
      },
      size: {
        default: "py-3 px-4 text-sm",
        small: "pl-3 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const alertVariantIcons: Record<"default" | "error" | "warning" | "info" | "success", React.ReactNode> = {
  default: null,
  error: <AlertCircle className="h-4 w-4 text-red-600" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  info: <Info className="h-4 w-4 text-blue-600" />,
  success: <CheckCircle2Icon className="h-4 w-4 text-green-600" />,
};

const alertButtonVariants = cva("shadow-none", {
  variants: {
    variant: {
      default: "secondary",
      error: "bg-error-background text-error-foreground hover:bg-error-background-muted",
      warning: "bg-warning-background text-warning-foreground hover:bg-warning-background-muted",
      info: "bg-info-background text-info-foreground hover:bg-info-background-muted",
      success: "bg-success-background text-success-foreground hover:bg-success-background-muted",
    },
    size: {
      default: "secondary lg",
      small: "sm bg-transparent hover:bg-transparent",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant = "default", size = "default", children, ...props }, ref) => {
  // Separate children into icon, content, and button for layout
  let iconElement: React.ReactNode = null;
  let contentElements: React.ReactNode[] = [];
  let buttonElement: React.ReactNode = null;

  // Process children to identify different parts
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      contentElements.push(child); // Non-element children go into content
      return;
    }

    const displayName = (child.type as any).displayName || "";
    if (displayName === "AlertButton") {
      buttonElement = child;
    } else if (typeof child.type !== "string" && !["AlertTitle", "AlertDescription"].includes(displayName)) {
      iconElement = React.cloneElement(child as React.ReactElement<any>, {
        className: cn("h-4 w-4", (child as React.ReactElement<any>).props.className || ""),
      });

      iconElement = !iconElement && variant ? alertVariantIcons[variant] : null;
    } else {
      // All other elements go into content
      contentElements.push(child);
    }
  });

  return (
    <AlertContext.Provider value={{ variant, size }}>
      <div ref={ref} role="alert" className={cn(alertVariants({ variant, size }), className)} {...props}>
        {/* Small size layout - row-based with vertical centering */}
        {size === "small" && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Icon */}
            {iconElement && <div className="flex-shrink-0">{iconElement}</div>}

            {/* Content area */}
            <div className="flex min-w-0 flex-grow flex-wrap items-baseline gap-2">{contentElements}</div>

            {/* Button */}
            {buttonElement}
          </div>
        )}

        {/* Default size layout - stacked with absolute icon */}
        {size === "default" && (
          <div className="relative">
            {/* Main content with proper padding when icon is present */}
            <div
              className={cn(
                "flex flex-col",
                iconElement ? "pl-6" : "" // Add padding when icon is present
              )}>
              <div className="flex flex-col">
                {/* Icon - absolutely positioned */}
                {iconElement && <div className="absolute left-0 top-0 mt-3.5">{iconElement}</div>}

                {/* Title and description stacked */}
                <div className="flex-grow">{contentElements}</div>
              </div>

              {/* Button at bottom right */}
              {buttonElement && <div className="mt-2 flex justify-end">{buttonElement}</div>}
            </div>
          </div>
        )}
      </div>
    </AlertContext.Provider>
  );
});
Alert.displayName = "Alert";

// Hook to use the alert context
const useAlertContext = () => React.useContext(AlertContext);

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

// AlertButton component
const AlertButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    variant?: string;
    size?: string;
    onClick?: (e: React.MouseEvent) => void;
  }
>(({ className, loading, children, variant: buttonVariant, size: buttonSize, ...props }, ref) => {
  const { variant, size } = useAlertContext();

  // Get button styling based on alert context
  const alertButtonStyle = alertButtonVariants({
    variant,
    size,
  });

  const finalButtonSize = (buttonSize || (size === "small" ? "sm" : "default")) as
    | "default"
    | "sm"
    | "lg"
    | "icon"
    | null;
  const finalButtonVariant = (buttonVariant || (size === "small" ? "link" : "secondary")) as
    | "default"
    | "link"
    | "secondary"
    | "destructive"
    | "outline"
    | "ghost"
    | null;

  return (
    <div className="ml-auto mt-auto flex-shrink-0 self-end">
      <Button
        ref={ref}
        className={cn(alertButtonStyle, className)}
        disabled={loading || props.disabled}
        variant={finalButtonVariant}
        size={finalButtonSize}
        {...props}>
        {loading ? "Loading..." : children}
      </Button>
    </div>
  );
});
AlertButton.displayName = "AlertButton";

export { Alert, AlertDescription, AlertTitle, AlertButton };
