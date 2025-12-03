import { AlertCircle } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";

interface InputProps extends React.ComponentProps<"input"> {
  /** Text direction for RTL language support */
  dir?: "ltr" | "rtl";
  /** Error message to display above the input */
  errorMessage?: string;
  /** Custom inline styles (merged last, can override CSS variables) */
  style?: React.CSSProperties;
}

function Input({ className, type, errorMessage, dir, style, ...props }: InputProps): React.JSX.Element {
  const hasError = Boolean(errorMessage);

  // Default styles driven by CSS variables
  const cssVarStyles: React.CSSProperties = {
    width: "var(--fb-input-width)",
    height: "var(--fb-input-height)",
    backgroundColor: "var(--fb-input-bg-color)",
    borderColor: "var(--fb-input-border-color)",
    borderRadius: "var(--fb-input-border-radius)",
    fontFamily: "var(--fb-input-font-family)",
    fontSize: "var(--fb-input-font-size)",
    fontWeight: "var(--fb-input-font-weight)" as React.CSSProperties["fontWeight"],
    color: "var(--fb-input-color)",
    paddingLeft: "var(--fb-input-padding-x)",
    paddingRight: "var(--fb-input-padding-x)",
    paddingTop: "var(--fb-input-padding-y)",
    paddingBottom: "var(--fb-input-padding-y)",
    boxShadow: "var(--fb-input-shadow)",
  };

  // Merge CSS variable styles with consumer-provided styles (consumer wins)
  const mergedStyles: React.CSSProperties = { ...cssVarStyles, ...style };

  return (
    <div className="space-y-1">
      {errorMessage ? (
        <div className="text-destructive flex items-center gap-1 text-sm" dir={dir}>
          <AlertCircle className="size-4" />
          <span>{errorMessage}</span>
        </div>
      ) : null}
      <input
        type={type}
        dir={dir}
        style={mergedStyles}
        data-slot="input"
        aria-invalid={hasError || undefined}
        className={cn(
          // Layout and behavior (Tailwind)
          "flex min-w-0 border outline-none transition-[color,box-shadow]",
          // Placeholder styling via CSS variable
          "[&::placeholder]:opacity-[var(--fb-input-placeholder-opacity)]",
          "placeholder:[color:var(--fb-input-placeholder-color)]",
          // Selection styling
          "selection:bg-primary selection:text-primary-foreground",
          // File input specifics
          "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
          // Focus ring
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          // Error state ring
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          // Disabled state
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  );
}

export { Input };
export type { InputProps };
