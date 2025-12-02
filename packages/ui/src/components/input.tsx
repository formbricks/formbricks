import { AlertCircle } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";

type InputProps = React.ComponentProps<"input"> & {
  dir?: "ltr" | "rtl";
  errorMessage?: string;
  style?: React.CSSProperties;
};

function Input({ className, type, errorMessage, dir, style, ...props }: InputProps) {
  const hasError = Boolean(errorMessage);

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
        style={style}
        data-slot="input"
        aria-invalid={hasError || undefined}
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input shadow-xs flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base outline-none transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className
        )}
        {...props}
      />
    </div>
  );
}
export { Input };
