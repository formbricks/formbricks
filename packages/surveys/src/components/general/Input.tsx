import { cn } from "@/lib/utils";
import { HTMLAttributes } from "preact/compat";

export interface InputProps extends HTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const Input = ({ className, ...props }: InputProps) => {
  return (
    <input
      className={cn(
        "focus:fb-border-brand fb-flex fb-h-10 fb-w-full fb-rounded-md fb-border fb-border-slate-300 fb-bg-transparent fb-px-3 fb-py-2 fb-text-sm fb-text-slate-800 placeholder:fb-text-slate-400 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-slate-400 focus:fb-ring-offset-2 disabled:fb-cursor-not-allowed disabled:fb-opacity-50 dark:fb-border-slate-500 dark:fb-text-slate-300",
        className ?? ""
      )}
      {...props}
    />
  );
};
