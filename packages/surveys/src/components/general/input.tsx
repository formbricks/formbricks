import { InputHTMLAttributes, forwardRef } from "preact/compat";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref} // Forward the ref to the input element
      className={cn(
        "flex w-full rounded-custom border border-border bg-input-bg px-3 py-2 text-sm text-subheading placeholder:text-placeholder focus:border-brand focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300",
        className ?? ""
      )}
      dir="auto"
      {...props}
    />
  );
});
