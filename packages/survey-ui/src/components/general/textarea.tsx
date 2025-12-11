import { AlertCircle } from "lucide-react";
import * as React from "react";
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
          <AlertCircle className="size-4" />
          <span>{errorMessage}</span>
        </div>
      ) : null}
      <textarea
        data-slot="textarea"
        dir={dir}
        aria-invalid={hasError || undefined}
        className={cn(
          "w-input h-input bg-input-bg border-input-border rounded-input font-input font-input-weight text-input-text px-input-x py-input-y shadow-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 field-sizing-content text-input flex min-h-16 border outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  );
}

export { Textarea };
