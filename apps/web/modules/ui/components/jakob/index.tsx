import { Button } from "@/modules/ui/components/button";
import { VariantProps, cva } from "class-variance-authority";
import { AlertCircle, AlertTriangle, CheckCircle, CheckCircle2Icon, Info, Terminal } from "lucide-react";
import * as React from "react";
import { cn } from "@formbricks/lib/cn";

// Define variant icons
const variantIcons = {
  default: <Terminal className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4 text-red-600" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  info: <Info className="h-4 w-4 text-blue-600" />,
  success: <CheckCircle2Icon className="h-4 w-4 text-green-600" />,
};

// Define alert styles with variants
const alertVariants = cva("relative w-full rounded-xl border", {
  variants: {
    variant: {
      default: "text-foreground border-border",
      error: "text-red-800 border-red-600/50",
      warning: "text-amber-800 border-amber-600/50",
      info: "text-blue-800 border-blue-600/50",
      success: "text-green-800 border-green-600/50",
    },
    size: {
      default: "py-3 px-4",
      small: "pl-3",
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

  const variantTextColors = {
    default: "",
    error: "text-red-800",
    warning: "text-amber-800",
    info: "text-blue-800",
    success: "text-green-800",
  };

  return {
    variant: size === "small" ? "link" : variant === "default" ? "secondary" : undefined,
    className:
      size === "small" && variant !== "default"
        ? variantTextColors[variant as keyof typeof variantTextColors]
        : variant !== "default" && size !== "small"
          ? variantStyles[variant as keyof typeof variantStyles]
          : "",
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

    // For small size, we want to extract the title and description separately for layout
    const childrenArray = React.Children.toArray(children);
    let title: React.ReactNode | null = null;
    let description: React.ReactNode | null = null;
    let otherContent: React.ReactNode[] = [];

    // Organize children by type
    childrenArray.forEach((child) => {
      if (React.isValidElement(child)) {
        if (child.type === AlertTitle) {
          title = child;
        } else if (child.type === AlertDescription && size !== "small") {
          description = child;
        } else if (child.type === AlertDescription && size === "small") {
          description = React.cloneElement(child, {
            className: cn("truncate", child.props.className),
          });
        } else {
          otherContent.push(child);
        }
      } else {
        otherContent.push(child);
      }
    });

    const buttonStyles = getButtonStyles(variant || "default", size || "default");

    return (
      <div ref={ref} role="alert" className={cn(alertVariants({ variant, size }), className)} {...props}>
        {size === "default" ? (
          <div className="flex">
            <div className="flex flex-grow items-start gap-2">
              {/* Icon section */}
              {renderIcon && <div className="mt-0.5 flex-shrink-0">{renderIcon}</div>}

              {/* Content section */}
              <div className="space-y-0.5">
                {title}
                {description}
                {otherContent}
              </div>
            </div>

            {/* Button section for default size - as a column */}
            {button && (
              <div className="ml-4 flex-shrink-0 self-end">
                {React.cloneElement(button, {
                  variant: buttonStyles.variant ?? button.props?.variant,
                  className: cn(button.props?.className, buttonStyles.className),
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Icon section */}
            {renderIcon && <div className="flex-shrink-0">{renderIcon}</div>}

            {/* Content section for small size - horizontal layout with truncation */}
            <div className="flex min-w-0 flex-1 items-baseline space-x-1">
              {title &&
                React.cloneElement(title as React.ReactElement, {
                  className: cn("truncate", (title as React.ReactElement).props.className),
                })}
              {description && (
                <div className="hidden truncate text-sm opacity-80 sm:block">{description}</div>
              )}
              {otherContent}
            </div>

            {/* Button section for small size */}
            {button && (
              <div className="flex-shrink-0">
                {React.cloneElement(button, {
                  variant: buttonStyles.variant ?? button.props?.variant,
                  className: cn(button.props?.className, buttonStyles.className),
                })}
              </div>
            )}
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
    <div ref={ref} className={cn("text-sm", className)} {...props}>
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
