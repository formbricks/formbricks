import { Button } from "@/modules/ui/components/button";
import { VariantProps, cva } from "class-variance-authority";
import { AlertCircle, AlertTriangle, CheckCircle2Icon, Info } from "lucide-react";
import * as React from "react";
import { cn } from "@formbricks/lib/cn";

// Enhanced interface for Alert props
interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof alertVariants> {
  variant?: "default" | "error" | "warning" | "info" | "success";
  size?: "default" | "small";
  icon?: React.ReactNode;
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

// const alertIconVariants = cva("w-4 h-4", {
//   variants: {
//     variant: {
//       default: null,
//       error: <AlertCircle className="text-red-600" />,
//       warning: <AlertTriangle className="text-amber-600" />,
//       info: <Info className="text-blue-600" />,
//       success: <CheckCircle2Icon className="text-green-600" />,
//     },
//     size: {
//       default: "w-4 h-4"
//     }
//   },
//   defaultVariants: {
//     variant: "default",
//   },
// });
const alertVariantIcons: Record<"default" | "error" | "warning" | "info" | "success", React.ReactNode> = {
  default: null,
  error: <AlertCircle className="h-4 w-4 text-red-600" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  info: <Info className="h-4 w-4 text-blue-600" />,
  success: <CheckCircle2Icon className="h-4 w-4 text-green-600" />,
};

const alertButtonVariants = cva("secondary shadow-none", {
  variants: {
    variant: {
      default: "secondary",
      error: "bg-red-50 text-red-800 hover:bg-red-100",
      warning: "bg-amber-50 text-amber-800 hover:bg-amber-100",
      info: "bg-blue-50 text-blue-800 hover:bg-blue-100",
      success: "bg-green-50 text-green-800 hover:bg-green-100",
    },
    // size: {
    //   default: "secondary",
    //   small: "link hover:bg-transparent",
    // },
  },
  defaultVariants: {
    variant: "default",
  },
});

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
      children,
      allowChildren = true,
      ...props
    },
    ref
  ) => {
    const renderIcon = icon ? icon : alertVariantIcons[variant];

    const textElement =
      title || description || children ? (
        <div className="flex flex-col gap-0.5">
          {title && <AlertTitle>{title}</AlertTitle>}
          {description && <AlertDescription>{description}</AlertDescription>}
          {children && allowChildren && <div>{children}</div>}
        </div>
      ) : undefined;

    const buttonElement = React.isValidElement(button) ? (
      button
    ) : button ? (
      <AlertButton
        onClick={button.onClick}
        loading={button.loading}
        disabled={button.disabled}
        className={alertButtonVariants({ variant })}
        variant={size === "small" ? "link" : "secondary"}
        // variant={"secondary"}
      >
        {button.label}
      </AlertButton>
    ) : undefined;

    return (
      <div ref={ref} role="alert" className={cn(alertVariants({ variant, size }), className)} {...props}>
        {size === "default" && title && description ? (
          <div className="flex">
            <div className="flex flex-grow items-center gap-2">
              {/* Icon section with optional click handler */}
              {renderIcon && <div className="mt-1 flex-shrink-0 self-start">{renderIcon}</div>}

              {/* Content section */}
              <div className="items-baseline space-y-1">
                <div className="flex flex-col gap-0.5">
                  {title && <AlertTitle>{title}</AlertTitle>}
                  {description && <AlertDescription>{description}</AlertDescription>}
                  {children && allowChildren && <div>{children}</div>}
                </div>
              </div>
            </div>

            {/* Button section for default size */}
            {buttonElement && (
              <div className="ml-4 flex-shrink-0 self-end">
                {buttonElement}
                {/* <ButtonWrapper buttonStyles={buttonStyles}>{buttonElement}</ButtonWrapper> */}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Icon section with optional click handler */}
            {renderIcon && <div className={cn("flex-shrink-0")}>{renderIcon}</div>}

            {/* Content section for small size - horizontal layout with truncation */}
            <div className="flex min-w-0 flex-1 items-baseline space-x-1 py-2 pr-3">
              {title && <AlertTitle>{title}</AlertTitle>}
              {description && <AlertDescription>{description}</AlertDescription>}
            </div>

            {/* Button section for small size */}
            {buttonElement && <div className="flex-shrink-0 self-end">{buttonElement}</div>}
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
  React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: string }
>(({ className, loading, children, ...props }, ref) => (
  <Button
    ref={ref}
    className={cn("shrink-0", className)}
    disabled={loading || props.disabled}
    {...props}
    variant={props.variant as "default" | "link" | "secondary" | "destructive" | "outline" | "ghost" | null}>
    {loading ? "Loading..." : children}
  </Button>
));
AlertButton.displayName = "AlertButton";

export { Alert, AlertDescription, AlertTitle, AlertButton };
