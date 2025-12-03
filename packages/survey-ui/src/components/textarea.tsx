import { AlertCircle } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";

type TextareaProps = React.ComponentProps<"textarea"> & {
  dir?: "ltr" | "rtl";
  errorMessage?: string;
  style?: React.CSSProperties;
};

function Textarea({ className, errorMessage, dir, style, ...props }: TextareaProps): React.JSX.Element {
  const hasError = Boolean(errorMessage);

  return (
    <div className="space-y-1">
      {errorMessage ? (
        <div className="text-destructive flex items-center gap-1 text-sm" dir={dir}>
          <AlertCircle className="size-4" />
          <span>{errorMessage}</span>
        </div>
      ) : null}
      <textarea
        data-slot="textarea"
        dir={dir}
        style={style}
        aria-invalid={hasError || undefined}
        className={cn(
          "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 field-sizing-content shadow-xs flex min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        {...props}
      />
    </div>
  );
}

export { Textarea };
