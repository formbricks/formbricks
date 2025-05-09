import { cn } from "@/lib/cn";
import * as React from "react";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "crossOrigin" | "dangerouslySetInnerHTML"> {
  crossOrigin?: "" | "anonymous" | "use-credentials" | undefined;
  dangerouslySetInnerHTML?: {
    __html: string;
  };
  isInvalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, isInvalid, ...props }, ref) => {
  return (
    <input
      className={cn(
        "focus:border-brand-dark flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300",
        className,
        isInvalid && "border border-red-500 focus:border-red-500"
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
