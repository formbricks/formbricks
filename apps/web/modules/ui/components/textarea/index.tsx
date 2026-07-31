import * as React from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  isInvalid?: boolean;
}

// Mirrors the Input component's border/focus treatment so single-line and multi-line fields look
// consistent. Defaults to a non-resizable min-height box; override via `className` when needed.
export const Textarea = ({ className, isInvalid, ref, ...props }: TextareaProps) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-20 w-full resize-none rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300",
        className,
        isInvalid && "border border-red-500 focus:border-red-500"
      )}
      {...props}
    />
  );
};
