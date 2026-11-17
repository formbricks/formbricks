import * as React from "react";
import { FB_PART } from "@/lib/parts";
import { cn } from "@/lib/utils";

interface InputProps extends React.ComponentProps<"input"> {
  /** Text direction for RTL language support */
  readonly dir?: "ltr" | "rtl" | "auto";
  /** Error message to display above the input */
  readonly errorMessage?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type, dir, ...props },
  ref
): React.JSX.Element {
  return (
    <div className="relative space-y-1">
      <input
        ref={ref}
        type={type}
        dir={dir}
        data-slot="input"
        data-fb-part={FB_PART.input}
        className={cn(
          // Layout and behavior
          "flex min-w-0 border transition-[color,box-shadow] outline-none",
          // Customizable styles via CSS variables (using Tailwind theme extensions)
          "min-h-[var(--fb-input-height)] w-input",
          "rounded-input border-input-border bg-input-bg",
          "font-input font-input-weight",
          "[font-size:var(--fb-input-font-size)] text-input-text",
          "px-input-x py-input-y",
          "shadow-input",
          // Placeholder styling
          "placeholder:opacity-input-placeholder",
          "placeholder:text-input-placeholder",

          // Selection styling
          "selection:bg-primary selection:text-primary-foreground",
          // File input specifics
          "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          // Focus ring
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring",
          // Error state ring
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          // Disabled state
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  );
});

export { Input };
export type { InputProps };
