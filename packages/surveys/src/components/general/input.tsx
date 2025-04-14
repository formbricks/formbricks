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
        "fb:focus:border-brand fb:bg-input-bg fb:flex fb:w-full fb:border fb:border-border fb:rounded-custom fb:px-3 fb:py-2 fb:text-sm fb:text-subheading fb:placeholder:text-placeholder fb:focus:outline-hidden fb:focus:ring-2 fb:focus:ring-offset-2 fb:disabled:cursor-not-allowed fb:disabled:opacity-50 fb:dark:border-slate-500 fb:dark:text-slate-300",
        className ?? ""
      )}
      dir="auto"
    />
  );
});
