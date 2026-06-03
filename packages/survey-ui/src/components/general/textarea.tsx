import { cn } from "@/lib/utils";

type TextareaProps = React.ComponentProps<"textarea"> & {
  dir?: "ltr" | "rtl" | "auto";
  errorMessage?: string;
};

function Textarea({ className, dir = "auto", ...props }: TextareaProps): React.JSX.Element {
  return (
    <div className="relative space-y-2">
      <textarea
        data-slot="textarea"
        dir={dir}
        className={cn(
          "w-input bg-input-bg border-input-border rounded-input font-input font-input-weight px-input-x py-input-y shadow-input placeholder:text-input-placeholder placeholder:opacity-input-placeholder focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive text-input-text flex field-sizing-content min-h-16 border [font-size:var(--fb-input-font-size)] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  );
}

export { Textarea };
