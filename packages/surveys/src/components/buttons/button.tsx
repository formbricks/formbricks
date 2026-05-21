import { ButtonHTMLAttributes } from "preact";
import { cn } from "@/lib/utils";

export type ButtonProps = {
  variant: "primary" | "secondary";
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant, className, children, ...rest }: Readonly<ButtonProps>) {
  return (
    <button
      dir="auto"
      type="button"
      className={cn([
        "border-border mb-1 flex items-center justify-center border leading-4",
        "focus:ring-focus shadow-xs focus:ring-2 focus:ring-offset-2 focus:outline-hidden",
        "enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
        [
          // secondary uses primary's bg color as text color and vice-versa
          'data-[variant="secondary"]:bg-(--fb-button-text-color)!',
          'data-[variant="secondary"]:text-(--fb-button-bg-color)!',
        ],
        String(className || ""),
      ])}
      data-variant={variant}
      style={{
        backgroundColor: "var(--fb-button-bg-color)",
        color: "var(--fb-button-text-color)",
        borderRadius: "var(--fb-button-border-radius)",
        height: "var(--fb-button-height)",
        fontSize: "var(--fb-button-font-size)",
        fontWeight: "var(--fb-button-font-weight)",
        paddingLeft: "var(--fb-button-padding-x)",
        paddingRight: "var(--fb-button-padding-x)",
        paddingTop: "var(--fb-button-padding-y)",
        paddingBottom: "var(--fb-button-padding-y)",
      }}
      {...rest}>
      {children}
    </button>
  );
}
