import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/modules/ui/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow enabled:hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm enabled:hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm enabled:hover:bg-accent enabled:hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm enabled:hover:bg-secondary/50",
        ghost: "enabled:hover:bg-accent enabled:hover:text-accent-foreground text-primary",
        link: "text-primary underline-offset-4 enabled:hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
        tall: "h-10 rounded-md px-3 text-xs",
      },
      loading: {
        true: "cursor-not-allowed opacity-50",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      loading: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, asChild = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, loading, className }))}
        ref={ref}
        {...props}
        aria-busy={loading || undefined}
        disabled={loading || disabled}>
        {loading ? (
          <>
            <span className="absolute inset-0 z-[1] flex items-center justify-center">
              <Loader2 className="animate-spin" />
            </span>
            <span className="flex select-none gap-2 opacity-40">{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
