import { ElementError } from "@/components/general/element-error";
import { cn } from "@/lib/utils";

type TextareaProps = React.ComponentProps<"textarea"> & {
  dir?: "ltr" | "rtl" | "auto";
  errorMessage?: string;
};

function Textarea({ className, errorMessage, dir = "auto", ...props }: TextareaProps): React.JSX.Element {
  const hasError = Boolean(errorMessage);

  return (
    <div className="relative space-y-2">
      <ElementError errorMessage={errorMessage} dir={dir} />
      <textarea
        data-slot="textarea"
        style={{ fontSize: "var(--fb-input-font-size)" }}
        dir={dir}
        aria-invalid={hasError || undefined}
        className={cn(
          "w-input bg-input-bg border-input-border rounded-input font-input font-input-weight px-input-x py-input-y shadow-input placeholder:text-input-placeholder placeholder:opacity-input-placeholder focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 text-input text-input-text flex field-sizing-content min-h-16 border transition-[color,box-shadow] outline-none placeholder:text-sm focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  );
}

export { Textarea };
