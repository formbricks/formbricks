import { AlertCircle } from "lucide-react";
import * as React from "react";

interface ElementErrorProps {
  /** Error message to display */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: "ltr" | "rtl" | "auto";
}

function ElementError({ errorMessage, dir = "auto" }: ElementErrorProps): React.JSX.Element | null {
  if (!errorMessage) {
    return null;
  }

  return (
    <>
      {/* Error indicator bar */}
      <div className="bg-destructive absolute bottom-0 left-[-12px] top-0 w-[4px]" />
      {/* Error message - shown at top */}
      <div className="text-destructive flex items-center gap-1 text-sm" dir={dir}>
        <AlertCircle className="size-4" />
        <span>{errorMessage}</span>
      </div>
    </>
  );
}

export { ElementError };
export type { ElementErrorProps };
