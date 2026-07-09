import { type ButtonHTMLAttributes, type CSSProperties } from "preact";
import { forwardRef } from "preact/compat";
import { cn } from "@/lib/utils";

export type ButtonProps = {
  variant: "primary" | "ghost";
} & ButtonHTMLAttributes<HTMLButtonElement>;

const buttonBaseClasses =
  "focus:ring-focus mb-1 flex items-center leading-4 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-60";

const buttonVariantClasses: Record<ButtonProps["variant"], string> = {
  primary:
    "button-custom border-submit-button-border justify-center border shadow-xs enabled:hover:opacity-90",
  ghost: "enabled:hover:bg-input-bg rounded-custom px-3 py-3 text-base font-medium",
};

const buttonVariantStyles: Record<ButtonProps["variant"], CSSProperties> = {
  primary: {
    borderRadius: "var(--fb-button-border-radius)",
    backgroundColor: "var(--fb-button-bg-color)",
    color: "var(--fb-button-text-color)",
    height: "var(--fb-button-height)",
    fontSize: "var(--fb-button-font-size)",
    fontWeight: "var(--fb-button-font-weight)",
    paddingLeft: "var(--fb-button-padding-x)",
    paddingRight: "var(--fb-button-padding-x)",
    paddingTop: "var(--fb-button-padding-y)",
    paddingBottom: "var(--fb-button-padding-y)",
  },
  ghost: {
    // Contrast-adjusted brand color (falls back to the raw brand when no custom theme is set).
    color: "var(--fb-back-button-color, var(--fb-button-bg-color))",
  },
};

const isCssProperties = (style: ButtonProps["style"]): style is CSSProperties => {
  return typeof style === "object" && style !== null && !("peek" in style);
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, className, children, style, dir = "auto", ...props }: Readonly<ButtonProps>, ref) => {
    const incomingClassName = typeof className === "string" ? className : undefined;
    const incomingStyle = isCssProperties(style) ? style : undefined;

    return (
      <button
        {...props}
        ref={ref}
        dir={dir}
        className={cn([buttonBaseClasses, buttonVariantClasses[variant], incomingClassName])}
        style={{ ...buttonVariantStyles[variant], ...incomingStyle }}>
        {children}
      </button>
    );
  }
);
