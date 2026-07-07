import * as React from "react";
import { ElementMedia } from "@/components/general/element-media";
import { Label } from "@/components/general/label";
import { cn } from "@/lib/utils";

interface ElementHeaderProps extends React.ComponentProps<"div"> {
  headline: string;
  description?: string;
  descriptionId?: string;
  required?: boolean;
  /** Custom label for the required indicator. Defaults to "Required" */
  requiredLabel?: string;
  htmlFor?: string;
  imageUrl?: string;
  videoUrl?: string;
  imageAltText?: string;
  /**
   * Id placed on the headline element. For grouped questions (radio/checkbox/matrix) the
   * surrounding native <fieldset> references this id via aria-labelledby instead of pointing
   * a htmlFor at a non-input, which keeps the group name correct without nesting block content
   * (media, etc.) inside a <legend> (invalid HTML).
   */
  headlineId?: string;
}

function ElementHeader({
  headline,
  description,
  descriptionId,
  required = false,
  requiredLabel = "Required",
  htmlFor,
  className,
  imageUrl,
  videoUrl,
  imageAltText,
  headlineId,
  ...props
}: Readonly<ElementHeaderProps>): React.JSX.Element {
  const isMediaAvailable = Boolean(imageUrl) || Boolean(videoUrl);

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {/* Media (Image or Video) */}
      {isMediaAvailable ? (
        <ElementMedia imgUrl={imageUrl} videoUrl={videoUrl} altText={imageAltText} />
      ) : null}

      {/* Headline */}
      <div>
        <div>{required ? <span className="label-card mb-[3px]">{requiredLabel}</span> : null}</div>
        <div className="flex">
          <Label htmlFor={htmlFor} id={headlineId} variant="headline">
            {headline}
          </Label>
        </div>
      </div>

      {/* Description/Subheader */}
      {description ? (
        <Label id={descriptionId} variant="description">
          {description}
        </Label>
      ) : null}
    </div>
  );
}

export { ElementHeader };
export type { ElementHeaderProps };
