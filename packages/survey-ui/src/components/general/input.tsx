import * as React from "react";
import { AlertCircleIcon } from "@/components/icons/alert-circle";
import { cn } from "@/lib/utils";

interface InputProps extends React.ComponentProps<"input"> {
  /** Text direction for RTL language support */
  dir?: "ltr" | "rtl" | "auto";
  /** Error message to display above the input */
  errorMessage?: string;
}

function Input({ className, type, errorMessage, dir, ...props }: InputProps): React.JSX.Element {
  const hasError = Boolean(errorMessage);

  return (
    <div className="space-y-1">
      {errorMessage ? (
        <div className="text-destructive flex items-center gap-1 text-sm" dir={dir}>
          <AlertCircleIcon className="size-4" />
          <span>{errorMessage}</span>
        </div>
      ) : null}
      <input
        type={type}
        dir={dir}
        data-slot="input"
        style={{
          // need to use style here because tailwind is not able to use css variables for font size
          fontSize: "var(--fb-input-font-size)",
        }}
        aria-invalid={hasError || undefined}
        className={cn(
          // Layout and behavior
          "flex min-w-0 border transition-[color,box-shadow] outline-none",
          // Customizable styles via CSS variables (using Tailwind theme extensions)
          "w-input h-input",
          "bg-input-bg border-input-border rounded-input",
          "font-input font-input-weight",
          "text-input-text",
          "px-input-x py-input-y",
          "shadow-input",
          // Placeholder styling
          "[&::placeholder]:opacity-input-placeholder",
          "placeholder:text-input-placeholder",
          // Selection styling
          "selection:bg-primary selection:text-primary-foreground",
          // File input specifics
          "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
          // Focus ring
          "focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[3px]",
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
