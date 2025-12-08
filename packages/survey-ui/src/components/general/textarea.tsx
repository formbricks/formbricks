import { AlertCircle } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils";

type TextareaProps = React.ComponentProps<"textarea"> & {
  dir?: "ltr" | "rtl" | "auto";
  errorMessage?: string;
};

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
        style={cssVarStyles}
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
