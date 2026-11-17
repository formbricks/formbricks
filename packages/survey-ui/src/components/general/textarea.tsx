import { FB_PART } from "@/lib/parts";
import { cn } from "@/lib/utils";

type TextareaProps = React.ComponentProps<"textarea"> & {
  readonly dir?: "ltr" | "rtl" | "auto";
  readonly errorMessage?: string;
};

function Textarea({ className, dir = "auto", ...props }: TextareaProps): React.JSX.Element {
  return (
    <div className="relative space-y-2">
      <textarea
        data-slot="textarea"
        data-fb-part={FB_PART.textarea}
        dir={dir}
        className={cn(
          "flex field-sizing-content min-h-16 w-input rounded-input border border-input-border bg-input-bg px-input-x py-input-y font-input [font-size:var(--fb-input-font-size)] font-input-weight text-input-text shadow-input transition-[color,box-shadow] outline-none placeholder:text-input-placeholder placeholder:opacity-input-placeholder focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          className
        )}
        {...props}
      />
    </div>
  );
}

export { Textarea };
