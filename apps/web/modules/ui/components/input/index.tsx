import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "crossOrigin" | "dangerouslySetInnerHTML"
> {
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
        // text-base below sm: iOS Safari zooms the viewport on focus for any input under 16px,
        // which on the auth screens throws the user out of the form (ENG-2428). Desktop keeps 14px.
        "flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-base text-slate-800 placeholder:text-slate-500 focus:border-brand-dark focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm dark:border-slate-500 dark:text-slate-300",
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
