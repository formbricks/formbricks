import * as React from "react";
import { AlertCircleIcon } from "@/components/icons/alert-circle";
import { cn } from "@/lib/utils";

type TextareaProps = React.ComponentProps<"textarea"> & {
  dir?: "ltr" | "rtl" | "auto";
  errorMessage?: string;
};

function Textarea({ className, errorMessage, dir = "auto", ...props }: TextareaProps): React.JSX.Element {
  const hasError = Boolean(errorMessage);

  return (
    <div className="space-y-1">
      {errorMessage ? (
        <div className="text-destructive flex items-center gap-1 text-sm" dir={dir}>
          <AlertCircleIcon className="size-4" />
          <span>{errorMessage}</span>
        </div>
      ) : null}
      <textarea
        data-slot="textarea"
        dir={dir}
        style={{
          fontSize: "var(--fb-input-font-size)",
        }}
        aria-invalid={hasError || undefined}
        className={cn(
          // Layout and behavior
          "flex min-w-0 border transition-[color,box-shadow] outline-none",
          // Customizable styles via CSS variables (using Tailwind theme extensions)
          "w-input",
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

export { Textarea };
