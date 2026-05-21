import { ButtonHTMLAttributes, CSSProperties } from "preact";
import { cn } from "@/lib/utils";

export type ButtonProps = {
  variant: "primary" | "secondary";
} & ButtonHTMLAttributes<HTMLButtonElement>;

const commonStyles: CSSProperties = {
  borderRadius: "var(--fb-button-border-radius)",
  height: "var(--fb-button-height)",
  fontSize: "var(--fb-button-font-size)",
  fontWeight: "var(--fb-button-font-weight)",
  paddingLeft: "var(--fb-button-padding-x)",
  paddingRight: "var(--fb-button-padding-x)",
  paddingTop: "var(--fb-button-padding-y)",
  paddingBottom: "var(--fb-button-padding-y)",
};

const variantStyles: Record<ButtonProps["variant"], CSSProperties> = {
  primary: { backgroundColor: "var(--fb-button-bg-color)", color: "var(--fb-button-text-color)" },
  // secondary uses primary's bg color as text color and vice-versa
  secondary: {
    backgroundColor: "var(--fb-button-text-color) !important",
    color: "var(--fb-button-bg-color) !important",
    borderColor: "var(--fb-button-text-color) !important",
  },
};

export function Button({ variant, children, ...rest }: Readonly<ButtonProps>) {
  return (
    <button
      dir="auto"
      type="button"
      className={cn([
        "border-submit-button-border",
        "mb-1 flex items-center justify-center border leading-4",
        "focus:ring-focus shadow-xs focus:ring-2 focus:ring-offset-2 focus:outline-hidden",
        "enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
        `button-custom button-${variant}-custom`,
      ])}
      style={{
        ...commonStyles,
        ...variantStyles[variant],
      }}
      {...rest}>
      {children}
    </button>
  );
}
