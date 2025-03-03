import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "preact/compat";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      {...props}
      ref={ref} // Forward the ref to the input element
      className={cn(
        "focus:fb-border-brand fb-bg-input-bg fb-flex fb-w-full fb-border fb-border-border fb-rounded-custom fb-px-3 fb-py-2 fb-text-sm fb-text-subheading placeholder:fb-text-placeholder focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2 disabled:fb-cursor-not-allowed disabled:fb-opacity-50 dark:fb-border-slate-500 dark:fb-text-slate-300",
        className ?? ""
      )}
      dir="auto"
    />
  );
});
