import { AlertCircle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface ElementErrorProps {
  /** Error message to display */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: "ltr" | "rtl" | "auto";
}

function ElementError({ errorMessage, dir = "auto" }: Readonly<ElementErrorProps>): React.JSX.Element | null {
  if (!errorMessage) {
    return null;
  }

  return (
    <>
      {/* Error indicator bar */}
      <div
        className={cn(
          "bg-destructive absolute top-0 bottom-0 w-[4px]",
          dir === "rtl" ? "right-[-10px]" : "left-[-10px]"
        )}
      />
      {/* Error message - shown at top */}
      <div className="text-destructive mb-2 flex items-center gap-1 text-sm" dir={dir}>
        <AlertCircle className="size-4" />
        <span>{errorMessage}</span>
      </div>
    </>
  );
}

export { ElementError };
export type { ElementErrorProps };
