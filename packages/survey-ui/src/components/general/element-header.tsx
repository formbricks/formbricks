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
  /**
   * Heading level the element prompt is exposed at (WCAG 2.4.6). Defaults to 2: the survey name
   * is the page's only h1, so every card prompt sits one level under it. A block that renders
   * several elements gets sibling headings at the same level, never a nested run.
   */
  headingLevel?: 2 | 3;
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
  headingLevel = 2,
  ...props
}: Readonly<ElementHeaderProps>): React.JSX.Element {
  const isMediaAvailable = Boolean(imageUrl) || Boolean(videoUrl);
  // The heading WRAPS the Label rather than replacing it: the six call sites that pass `htmlFor`
  // need the prompt to stay a real <label> bound to their input, the grouped questions need
  // `headlineId` to stay on the element whose text names the fieldset via aria-labelledby, and
  // user theming targets the `label-headline` class (styles.ts `addCustomThemeToDom`), not the tag.
  // A <label> nested inside a heading is valid HTML and changes neither association.
  const HeadingTag = `h${headingLevel.toString()}` as "h2" | "h3";

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {/* Media (Image or Video) */}
      {isMediaAvailable ? (
        <ElementMedia imgUrl={imageUrl} videoUrl={videoUrl} altText={imageAltText} />
      ) : null}

      {/* Headline */}
      <div>
        <div>{required ? <span className="label-card mb-[3px]">{requiredLabel}</span> : null}</div>
        <HeadingTag className="flex" data-slot="element-headline">
          <Label htmlFor={htmlFor} id={headlineId} variant="headline">
            {headline}
          </Label>
        </HeadingTag>
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
