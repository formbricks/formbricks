import { Button } from "@/modules/ui/components/button";
import { VariantProps, cva } from "class-variance-authority";
import { AlertCircle, AlertTriangle, CheckCircle, Info, Terminal } from "lucide-react";
import * as React from "react";
import { cn } from "@formbricks/lib/cn";

// Define variant icons
const variantIcons = {
  default: <Terminal className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4 text-red-600" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  info: <Info className="h-4 w-4 text-blue-600" />,
  success: <CheckCircle className="h-4 w-4 text-green-600" />,
};

// Define alert styles with variants
const alertVariants = cva("relative w-full rounded-xl border flex items-start gap-2", {
  variants: {
    variant: {
      default: "text-foreground border-border",
      error: "text-red-800 border-red-600",
      warning: "text-amber-800 border-amber-600",
      info: "text-blue-800 border-blue-600",
      success: "text-green-800 border-green-600",
    },
    size: {
      default: "py-3 px-4 gap-3",
      small: "py-0 px-3 gap-2",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

// Define button styles based on variant
const getButtonStyles = (variant: string, size: string) => {
  const variantStyles = {
    default: "secondary",
    error: "bg-red-50 text-red-800 shadow-none hover:bg-red-50/80",
    warning: "bg-amber-50 text-amber-800 shadow-none hover:bg-amber-50/80",
    info: "bg-blue-50 text-blue-800 shadow-none hover:bg-blue-50/80",
    success: "bg-green-50 text-green-800 shadow-none hover:bg-green-50/80",
  };

  return {
    variant: size === "small" ? "link" : variant === "default" ? "secondary" : undefined,
    className:
      variant !== "default" && size !== "small" ? variantStyles[variant as keyof typeof variantStyles] : "",
  };
};

// Component props
type AlertJakobProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants> & {
    icon?: React.ReactNode;
    button?: React.ReactElement;
  };

const AlertJakob = React.forwardRef<HTMLDivElement, AlertJakobProps>(
  ({ className, variant = "default", size = "default", icon, button, children, ...props }, ref) => {
    // Get the icon based on variant or use provided icon
    const renderIcon = icon === undefined ? variantIcons[variant as keyof typeof variantIcons] : icon;

    // Filter descriptions for small size
    const content = React.Children.toArray(children).filter((child) => {
      if (size === "small" && React.isValidElement(child) && child.type === AlertDescription) {
        return false;
      }
      return true;
    });

    const buttonStyles = getButtonStyles(variant || "default", size || "default");

    return (
      <div ref={ref} role="alert" className={cn(alertVariants({ variant, size }), className)} {...props}>
        {/* Icon section */}
        {renderIcon && <div className="mt-0.5 flex-shrink-0">{renderIcon}</div>}

        {/* Content section */}
        <div className="flex-grow">{content}</div>

        {/* Button section */}
        {button && (
          <div className="ml-auto flex-shrink-0 self-start">
            {React.cloneElement(button, {
              variant: buttonStyles.variant ?? button.props?.variant,
              className: cn(button.props?.className, buttonStyles.className),
            })}
          </div>
        )}
      </div>
    );
  }
);
AlertJakob.displayName = "AlertJakob";

// AlertTitle component
const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h5 ref={ref} className={cn("text-sm font-medium leading-none", className)} {...props}>
      {children}
    </h5>
  )
);
AlertTitle.displayName = "AlertTitle";

// AlertDescription component
const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("mt-1 text-sm", className)} {...props}>
      {children}
    </div>
  )
);
AlertDescription.displayName = "AlertDescription";

// AlertButton component
const AlertButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }
>(({ className, loading, children, ...props }, ref) => (
  <Button ref={ref} className={cn("shrink-0", className)} disabled={loading || props.disabled} {...props}>
    {loading ? "Loading..." : children}
  </Button>
));
AlertButton.displayName = "AlertButton";

export { AlertJakob, AlertDescription, AlertTitle, AlertButton };
