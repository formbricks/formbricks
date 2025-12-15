import * as React from "react";
import { ElementMedia } from "@/components/general/element-media";
import { Label } from "@/components/general/label";
import { cn } from "@/lib/utils";

interface ElementHeaderProps extends React.ComponentProps<"div"> {
  headline: string;
  description?: string;
  required?: boolean;
  htmlFor?: string;
  imageUrl?: string;
  videoUrl?: string;
  imageAltText?: string;
}

function ElementHeader({
  headline,
  description,
  required = false,
  htmlFor,
  className,
  imageUrl,
  videoUrl,
  imageAltText,
  ...props
}: ElementHeaderProps): React.JSX.Element {
  const isMediaAvailable = imageUrl ?? videoUrl;

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {/* Media (Image or Video) */}
      {isMediaAvailable ? (
        <ElementMedia imgUrl={imageUrl} videoUrl={videoUrl} altText={imageAltText} />
      ) : null}

      {/* Headline */}
      <div className="flex">
        <Label htmlFor={htmlFor} variant="headline">
          {headline}
        </Label>
        {required ? <span className="label-headline">*</span> : null}
      </div>

      {/* Description/Subheader */}
      {description ? (
        <Label htmlFor={htmlFor} variant="description">
          {description}
        </Label>
      ) : null}
    </div>
  );
}

export { ElementHeader };
export type { ElementHeaderProps };
