import { LucideIcon } from "lucide-react";
import Link, { LinkProps } from "next/link";
import React, { AnchorHTMLAttributes, ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@formbricks/lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../Tooltip";

type SVGComponent = React.FunctionComponent<React.SVGProps<SVGSVGElement>> | LucideIcon;

export type ButtonBaseProps = {
  variant?: "highlight" | "primary" | "secondary" | "minimal" | "warn" | "alert";
  size?: "base" | "sm" | "lg" | "fab" | "icon";
  loading?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLElement, MouseEvent>) => void;
  StartIcon?: SVGComponent | React.ComponentType<React.ComponentProps<"svg">>;
  startIconClassName?: string;
  EndIcon?: SVGComponent | React.ComponentType<React.ComponentProps<"svg">>;
  endIconClassName?: string;
  shallow?: boolean;
  tooltip?: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  tooltipOffset?: number;
};
type ButtonBasePropsWithTarget = ButtonBaseProps & { target?: string };

export type ButtonProps = ButtonBasePropsWithTarget &
  (
    | (Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick" | "target"> & LinkProps)
    | (Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "target"> & { href?: never })
  );

export const Button: React.ForwardRefExoticComponent<
  React.PropsWithoutRef<ButtonProps> & React.RefAttributes<HTMLAnchorElement | HTMLButtonElement>
> = forwardRef<HTMLAnchorElement | HTMLButtonElement, ButtonProps>((props: ButtonProps, forwardedRef) => {
  const {
    loading = false,
    variant = "primary",
    size = "base",
    StartIcon,
    startIconClassName,
    endIconClassName,
    EndIcon,
    shallow,
    tooltipSide = "top",
    tooltipOffset = 4,
    // attributes propagated from `HTMLAnchorProps` or `HTMLButtonProps`
    ...passThroughProps
  } = props;
  // Buttons are **always** disabled if we're in a `loading` state
  const disabled = props.disabled || loading;

  // If pass an `href`-attr is passed it's `<a>`, otherwise it's a `<button />`
  const isLink = typeof props.href !== "undefined";
  const elementType = isLink ? "span" : "button";

  const element: any = React.createElement(
    elementType,
    {
      ...passThroughProps,
      disabled,
      ref: forwardedRef,
      className: cn(
        // base styles independent what type of button it is
        "inline-flex items-center appearance-none",
        // different styles depending on size
        size === "sm" && "px-3 py-2 text-sm leading-4 font-medium rounded-md",
        size === "base" && "px-6 py-3 text-sm font-medium rounded-md",
        size === "lg" && "px-8 py-4 text-base font-medium rounded-md",
        size === "icon" &&
          "w-10 h-10 justify-center group p-2 border rounded-lg border-transparent text-neutral-400 hover:border-slate-200 transition",
        // turn button into a floating action button (fab)
        size === "fab" ? "fixed" : "relative",
        size === "fab" && "justify-center bottom-20 right-8 rounded-full p-4 w-14 h-14",

        // different styles depending on variant
        variant === "highlight" &&
          (disabled
            ? "border border-transparent bg-slate-400 text-white"
            : "text-white bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-900 transition ease-in-out delay-50 hover:scale-105"),
        variant === "primary" &&
          (disabled
            ? "text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-800"
            : "text-slate-100 hover:text-slate-50 bg-gradient-to-br from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-1  focus:bg-slate-700 focus:ring-neutral-500"),

        variant === "minimal" &&
          (disabled
            ? "border border-slate-200 text-slate-400"
            : "hover:text-slate-600 text-slate-700 border border-transparent focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-neutral-900 dark:text-slate-700 dark:hover:text-slate-500"),
        variant === "alert" &&
          (disabled
            ? "border border-transparent bg-slate-400 text-white"
            : "border border-transparent dark:text-darkmodebrandcontrast text-brandcontrast bg-red-600 dark:bg-darkmodebrand hover:bg-opacity-90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-neutral-900"),
        variant === "secondary" &&
          (disabled
            ? "text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-800"
            : "text-slate-600 hover:text-slate-500 bg-slate-200 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-1  focus:bg-slate-300 focus:ring-neutral-500"),
        variant === "warn" &&
          (disabled
            ? "text-slate-400 bg-transparent"
            : "hover:bg-red-200 text-red-700 bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:bg-red-50 focus:ring-red-500"),

        // set not-allowed cursor if disabled
        loading ? "cursor-wait" : disabled ? "cursor-not-allowed" : "",
        props.className
      ),
      // if we click a disabled button, we prevent going through the click handler
      onClick: disabled
        ? (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
            e.preventDefault();
          }
        : props.onClick,
    },
    <>
      {StartIcon && (
        <StartIcon
          className={cn("flex", size === "icon" ? "h-4 w-4" : "-ml-1 mr-1 h-3 w-3", startIconClassName || "")}
        />
      )}
      {props.children}
      {loading && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform">
          <svg
            className={cn(
              "mx-4 h-5 w-5 animate-spin",
              variant === "primary" ? "text-white dark:text-slate-900" : "text-slate-900"
            )}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
      {EndIcon && <EndIcon className={cn("-mr-1 ml-2 inline h-5 w-5 rtl:mr-2", endIconClassName || "")} />}
    </>
  );
  return props.href ? (
    <Link passHref href={props.href} shallow={shallow && shallow} target={props.target || "_self"}>
      {element}
    </Link>
  ) : (
    <Wrapper
      data-testid="wrapper"
      tooltip={props.tooltip}
      tooltipSide={tooltipSide}
      tooltipOffset={tooltipOffset}>
      {element}
    </Wrapper>
  );
});

const Wrapper = ({
  children,
  tooltip,
  tooltipSide = "top",
  tooltipOffset = 0,
}: {
  tooltip?: string;
  children: React.ReactNode;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  tooltipOffset?: number;
}) => {
  if (!tooltip) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={tooltipSide} sideOffset={tooltipOffset}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

Button.displayName = "Button";
