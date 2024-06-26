import { Search } from "lucide-react";
import * as React from "react";
import { cn } from "@formbricks/lib/cn";

export interface SearchBoxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "crossOrigin" | "dangerouslySetInnerHTML"> {
  crossOrigin?: "" | "anonymous" | "use-credentials" | undefined;
  dangerouslySetInnerHTML?: {
    __html: string;
  };
}

const SearchBox = React.forwardRef<HTMLInputElement, SearchBoxProps>(({ className, ...props }, ref) => {
  return (
    <div className="relative">
      <input
        className={cn(
          "focus:border-brand flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-5 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300",
          className
        )}
        ref={ref}
        {...props}
      />
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <Search className="h-5 w-5 text-slate-400" />
      </div>
    </div>
  );
});

SearchBox.displayName = "SearchBox";

export { SearchBox };
