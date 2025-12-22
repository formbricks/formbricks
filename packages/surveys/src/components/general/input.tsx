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
        "focus:border-brand bg-input-bg border-border rounded-custom text-subheading placeholder:text-placeholder flex w-full border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300",
        className ?? ""
      )}
      dir="auto"
      {...props}
    />
  );
});
