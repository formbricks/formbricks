import * as React from "react";
import { Label } from "@/components/general/label";
import { cn } from "@/lib/utils";

interface ElementHeaderProps extends React.ComponentProps<"div"> {
  headline: string;
  description?: string;
  required?: boolean;
  htmlFor?: string;
}

function ElementHeader({
  headline,
  description,
  required = false,
  htmlFor,
  className,
  ...props
}: ElementHeaderProps): React.JSX.Element {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {/* Headline */}
      <div className="flex">
        <Label htmlFor={htmlFor} variant="headline">
          {headline}
        </Label>
        {required && <span>*</span>}
      </div>

      {/* Description/Subheader */}
      {description && (
        <Label htmlFor={htmlFor} variant="description">
          {description}
        </Label>
      )}
    </div>
  );
}

export { ElementHeader };
export type { ElementHeaderProps };
