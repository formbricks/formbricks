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
   * Element used to wrap the header. Use "legend" for grouped questions (radio/checkbox/matrix)
   * so the headline names the surrounding native fieldset instead of dangling on a non-input
   * via htmlFor. Defaults to "div" for questions that keep a normal label-to-input association.
   */
  as?: "div" | "legend";
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
  as = "div",
  ...props
}: Readonly<ElementHeaderProps>): React.JSX.Element {
  const isMediaAvailable = Boolean(imageUrl) || Boolean(videoUrl);
  const isLegend = as === "legend";

  // In legend mode the surrounding <fieldset> takes its accessible name from the legend text,
  // so the headline must not point at a non-input control via htmlFor. The Label component
  // sanitizes any HTML headline internally, so no extra processing is needed here.
  const headlineHtmlFor = isLegend ? undefined : htmlFor;

  const headerContent = (
    <>
      {/* Media (Image or Video) */}
      {isMediaAvailable ? (
        <ElementMedia imgUrl={imageUrl} videoUrl={videoUrl} altText={imageAltText} />
      ) : null}

      {/* Headline */}
      <div>
        <div>{required ? <span className="label-card mb-[3px]">{requiredLabel}</span> : null}</div>
        <div className="flex">
          <Label htmlFor={headlineHtmlFor} variant="headline">
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
    </>
  );

  if (isLegend) {
    // The public props are div-shaped; drop the div-typed ref when rendering as a <legend>.
    const { ref: _ref, ...legendProps } = props;
    return (
      <legend className={cn("w-full space-y-2", className)} {...legendProps}>
        {headerContent}
      </legend>
    );
  }

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {headerContent}
    </div>
  );
}

export { ElementHeader };
export type { ElementHeaderProps };
