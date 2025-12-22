import { SquareArrowOutUpRightIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/general/button";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";

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
  errorMessage,
  dir = "auto",
  disabled = false,
  buttonVariant = "default",
  imageUrl,
  videoUrl,
}: Readonly<CTAProps>): React.JSX.Element {
  const handleButtonClick = (): void => {
    if (disabled) return;
    onClick();

    if (buttonExternal && buttonUrl) {
      window.open(buttonUrl, "_blank")?.focus();
    }
  };

  return (
    <div className="w-full space-y-4" id={elementId} dir={dir}>
      {/* Headline */}
      <ElementHeader
        headline={headline}
        description={description}
        required={required}
        htmlFor={inputId}
        imageUrl={imageUrl}
        videoUrl={videoUrl}
      />

      {/* CTA Button */}
      <div className="relative space-y-2">
        <ElementError errorMessage={errorMessage} dir={dir} />

        {buttonExternal && (
          <div className="flex w-full justify-start">
            <Button
              id={inputId}
              type="button"
              onClick={handleButtonClick}
              disabled={disabled}
              className="flex items-center gap-2"
              variant={buttonVariant}>
              {buttonLabel}
              <SquareArrowOutUpRightIcon className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export { CTA };
