import { SquareArrowOutUpRightIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/general/button";
import { ElementError, getElementErrorAria } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { isSafeLinkUrl } from "@/lib/url";

/**
 * Props for the CTA (Call to Action) element component
 */
export interface CTAProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main element or prompt text displayed as the headline */
  headline: string;
  /** Optional descriptive text displayed below the headline */
  description?: string;
  /** Unique identifier for the CTA button */
  inputId: string;
  /** Label text for the CTA button */
  buttonLabel: string;
  /** URL to open when button is clicked (if external button) */
  buttonUrl?: string;
  /** Whether the button opens an external URL */
  buttonExternal?: boolean;
  /** Callback function called when button is clicked */
  onClick: () => void;
  /** Whether the field is required (shows asterisk indicator) */
  required?: boolean;
  /** Custom label for the required indicator */
  requiredLabel?: string;
  /** Error message to display */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: "ltr" | "rtl" | "auto";
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Variant for the button */
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "custom";
  /** Image URL to display above the headline */
  imageUrl?: string;
  /** Video URL to display above the headline */
  videoUrl?: string;
}

function CTA({
  elementId,
  headline,
  description,
  inputId,
  buttonLabel,
  buttonUrl,
  buttonExternal = false,
  onClick,
  required = false,
  requiredLabel,
  errorMessage,
  dir = "auto",
  disabled = false,
  buttonVariant = "default",
  imageUrl,
  videoUrl,
}: Readonly<CTAProps>): React.JSX.Element {
  const errorAria = getElementErrorAria(inputId, errorMessage);

  const handleButtonClick = (): void => {
    if (disabled) return;
    onClick();

    // `isSafeLinkUrl` gate: `buttonUrl` is an editable survey field, and a `javascript:` value reaching
    // `window.open()` executes on the survey's own origin. `noopener` is what keeps the opened tab from
    // reaching back through `window.opener` into the authenticated page that opened it; it also makes
    // `window.open` return null, so there is no handle left to `focus()`.
    if (buttonExternal && buttonUrl && isSafeLinkUrl(buttonUrl)) {
      window.open(buttonUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="w-full space-y-4" id={elementId} dir={dir}>
      {/* Headline */}
      <ElementHeader
        headline={headline}
        description={description}
        required={required}
        requiredLabel={requiredLabel}
        htmlFor={inputId}
        imageUrl={imageUrl}
        videoUrl={videoUrl}
      />

      {/* CTA Button. No `space-y-*` here: ElementError's live region is always mounted, so a
          child-spacing utility would reserve a gap under the (empty) region in the default state
          and shift the button down. Spacing under a *visible* error comes from the region's own
          error-gated `mb-2`, matching every other ElementError call site. */}
      <div className="relative" data-element-input>
        <ElementError errorMessage={errorMessage} dir={dir} id={errorAria.errorId} />

        {buttonExternal ? (
          <div className="flex w-full justify-start">
            <Button
              id={inputId}
              type="button"
              onClick={handleButtonClick}
              disabled={disabled}
              aria-invalid={errorAria.ariaInvalid}
              aria-describedby={errorAria.ariaDescribedBy}
              className="text-button font-button-weight flex items-center gap-2"
              variant={buttonVariant}
              size="custom">
              {buttonLabel}
              <SquareArrowOutUpRightIcon className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { CTA };
