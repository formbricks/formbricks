import { useState } from "preact/hooks";
// Import as Cta to fix sonar issue - "Imported JSX component CTA must be in PascalCase"
import { CTA as Cta } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyCTAElement } from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface CTAElementProps {
  element: TSurveyCTAElement;
  value: string;
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentElementId: string;
  onOpenExternalURL?: (url: string) => void | Promise<void>;
}

export function CTAElement({
  element,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  onOpenExternalURL,
}: Readonly<CTAElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isCurrent = element.id === currentElementId;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  const handleClick = () => {
    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
    onChange({ [element.id]: "clicked" });

    // Handle external URL opening if needed
    if (element.buttonExternal && element.buttonUrl) {
      if (onOpenExternalURL) {
        onOpenExternalURL(element.buttonUrl);
      }
      // Note: The survey-ui CTA component handles external URL opening itself
    }
  };

  return (
    <form
      key={element.id}
      onSubmit={(e) => {
        e.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
      }}
      className="w-full">
      <Cta
        elementId={element.id}
        inputId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        buttonLabel={getLocalizedValue(element.ctaButtonLabel, languageCode)}
        buttonUrl={element.buttonUrl}
        buttonExternal={element.buttonExternal}
        onClick={handleClick}
        // CTA cannot be required
        required={false}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
