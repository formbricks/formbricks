"use client";

import { Button } from "@/modules/ui/components/button";
import { VariantProps, cva } from "class-variance-authority";
import { AlertCircle, AlertTriangle, CheckCircle2Icon, Info } from "lucide-react";
import * as React from "react";
import { cn } from "@formbricks/lib/cn";

// Define variant icons - now using cloneElement to ensure consistent sizing
const variantIcons = {
  default: null,
  error: <AlertCircle className="text-red-600" />,
  warning: <AlertTriangle className="text-amber-600" />,
  info: <Info className="text-blue-600" />,
  success: <CheckCircle2Icon className="text-green-600" />,
};

// Define alert styles with variants
const alertVariants = cva("relative w-full rounded-md border", {
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
    size: size === "small" ? "sm" : "default",
    className:
      size === "small" && variant !== "default"
        ? variantTextColors[variant as keyof typeof variantTextColors]
        : variant !== "default" && size !== "small"
          ? variantStyles[variant as keyof typeof variantStyles]
          : "",
  };
};

// Enhanced interface for Alert props
interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
  onIconClick?: (e: React.MouseEvent) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  button?:
    | React.ReactElement
    | {
        label: string;
        onClick: (e: React.MouseEvent) => void;
        loading?: boolean;
        disabled?: boolean;
        className?: string;
        variant?: string;
      };
  allowChildren?: boolean;
}

// Add new ButtonWrapper component
const ButtonWrapper = ({
  buttonStyles,
  children,
}: {
  buttonStyles: { variant?: string; size?: string; className?: string };
  children: React.ReactElement;
}) => {
  return React.cloneElement(children, {
    variant: buttonStyles.variant ?? children.props.variant,
    size: buttonStyles.size ?? children.props.size,
    className: cn(children.props.className, buttonStyles.className),
  });
};

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      icon,
      title,
      description,
      button,
      onIconClick,
      children,
      allowChildren = false,
      ...props
    },
    ref
  ) => {
    // Get the icon based on variant or use provided icon, and ensure consistent sizing
    let renderIcon = null;

    if (icon !== null) {
      if (icon === undefined && variantIcons[variant as keyof typeof variantIcons]) {
        // Use variant icon with consistent sizing
        const variantIcon = variantIcons[variant as keyof typeof variantIcons];
        renderIcon = variantIcon
          ? React.cloneElement(variantIcon, {
              className: cn("h-4 w-4", variantIcon.props.className),
            })
          : null;
      } else if (React.isValidElement(icon)) {
        // Apply consistent sizing to custom icon unless it explicitly has size classes
        const iconProps = icon.props || {};
        const hasExplicitSize =
          iconProps.className && (iconProps.className.includes("h-") || iconProps.className.includes("w-"));

        renderIcon = hasExplicitSize
          ? icon
          : React.cloneElement(icon, {
              className: cn("h-4 w-4", iconProps.className),
            });
      }
    }

    // Process children if they're provided alongside structured props
    const childrenArray = React.Children.toArray(children);
    let extractedTitle: React.ReactNode = title;
    let extractedDescription: React.ReactNode = description;
    let otherContent: React.ReactNode[] = [];

    // Process children for backward compatibility
    if (allowChildren && children) {
      childrenArray.forEach((child) => {
        if (React.isValidElement(child)) {
          if (child.type === AlertTitle && !extractedTitle) {
            extractedTitle = child.props.children;
          } else if (child.type === AlertDescription && !extractedDescription) {
            extractedDescription = child.props.children;
          } else {
            otherContent.push(child);
          }
        } else {
          otherContent.push(child);
        }
      });
    }

    // Handle button creation from either React element or props object
    const buttonElement = React.isValidElement(button) ? (
      button
    ) : button ? (
      <AlertButton
        onClick={button.onClick}
        loading={button.loading}
        disabled={button.disabled}
        className={button.className}
        variant={button.variant}>
        {button.label}
      </AlertButton>
    ) : undefined;

    const buttonStyles = getButtonStyles(variant || "default", size || "default");

    // Create structured content
    const titleElement = extractedTitle ? <AlertTitle>{extractedTitle}</AlertTitle> : null;
    const descriptionElement = extractedDescription ? (
      size === "small" ? (
        <AlertDescription className="truncate">{extractedDescription}</AlertDescription>
      ) : (
        <AlertDescription>{extractedDescription}</AlertDescription>
      )
    ) : null;

    return (
      <div ref={ref} role="alert" className={cn(alertVariants({ variant, size }), className)} {...props}>
        {size === "default" ? (
          <div className="flex">
            <div className="flex flex-grow items-start gap-2">
              {/* Icon section with optional click handler */}
              {renderIcon && (
                <div
                  className={cn("mt-0.5 flex-shrink-0", onIconClick && "cursor-pointer")}
                  onClick={onIconClick}>
                  {renderIcon}
                </div>
              )}

              {/* Content section */}
              <div className="space-y-0.5">
                {titleElement}
                {descriptionElement}
                {allowChildren && otherContent}
              </div>
            </div>

            {/* Button section for default size */}
            {buttonElement && (
              <div className="ml-4 flex-shrink-0 self-end">
                <ButtonWrapper buttonStyles={buttonStyles}>{buttonElement}</ButtonWrapper>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Icon section with optional click handler */}
            {renderIcon && (
              <div className={cn("flex-shrink-0", onIconClick && "cursor-pointer")} onClick={onIconClick}>
                {renderIcon}
              </div>
            )}

            {/* Content section for small size - horizontal layout with truncation */}
            <div className="flex min-w-0 flex-1 items-baseline space-x-1 py-2 pr-3">
              {titleElement &&
                React.cloneElement(titleElement as React.ReactElement, {
                  className: cn("truncate", (titleElement as React.ReactElement).props.className),
                })}
              {descriptionElement && (
                <div className="hidden truncate text-sm opacity-80 sm:block">{descriptionElement}</div>
              )}
              {allowChildren && otherContent}
            </div>

            {/* Button section for small size */}
            {buttonElement && (
              <div className="flex-shrink-0">
                <ButtonWrapper buttonStyles={buttonStyles}>{buttonElement}</ButtonWrapper>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);
Alert.displayName = "Alert";

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

export { Alert, AlertDescription, AlertTitle, AlertButton };
