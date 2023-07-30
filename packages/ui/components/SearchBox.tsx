import * as React from "react";
import { cn } from "@formbricks/lib/cn";
import { SearchIcon } from "./../index";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "crossOrigin" | "dangerouslySetInnerHTML"> {
  crossOrigin?: "" | "anonymous" | "use-credentials" | undefined;
  dangerouslySetInnerHTML?: {
    __html: string;
  };
}

const SearchBox = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <div className="relative">
      <input
        className={cn(
          "focus:border-brand flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300",
          className
        )}
        ref={ref}
        {...props}
      />
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <SearchIcon className="h-5 w-5 text-gray-400" />
      </div>
    </div>
  );
});

export { SearchBox };
