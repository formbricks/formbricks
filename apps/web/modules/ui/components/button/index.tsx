import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { cn } from "@/modules/ui/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import { Loader2, LucideIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { FC, SVGProps } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-fill-primary text-labelColor-primary hover:bg-fill-primary/80",
        warn: "bg-error/20 text-error hover:bg-error/30",
        outline: "border border-borderColor-primary hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-fill-secondary text-labelColor-secondary hover:bg-secondary/80",
        minimal: "hover:bg-accent hover:text-accent-foreground",
        link: "text-focus underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  icon?: LucideIcon | FC<SVGProps<SVGSVGElement>>;
  tooltip?: string;
  href?: string;
  loading?: boolean;
  target?: string;
  iconPlacement?: "start" | "end";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      icon,
      tooltip,
      href,
      target,
      loading = false,
      asChild = false,
      iconPlacement = "start",
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const Icon = icon;
    const content = (
      <>
        {!loading && Icon && iconPlacement === "start" && <Icon />}
        {loading ? <Loader2 className="animate-spin" /> : props.children}
        {!loading && Icon && iconPlacement === "end" && <Icon />}
      </>
    );

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {href ? (
              <Link href={href} target={target}>
                <Comp
                  className={cn(buttonVariants({ variant, size, className }))}
                  ref={ref}
                  disabled={loading}
                  {...props}>
                  {content}
                </Comp>
              </Link>
            ) : (
              <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={loading}
                {...props}>
                {content}
              </Comp>
            )}
          </TooltipTrigger>
          {tooltip && (
            <TooltipContent>
              <p>{tooltip}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
