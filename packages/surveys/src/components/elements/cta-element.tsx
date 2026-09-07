import { useState } from "preact/hooks";
// Import as Cta to fix sonar issue - "Imported JSX component CTA must be in PascalCase"
import { CTA as Cta, isSafeLinkUrl } from "@formbricks/survey-ui";
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

    // `onOpenExternalURL` is a host-supplied hook (e.g. a native bridge), and nothing documents that the
    // URL it receives is pre-validated — so the scheme is checked here too, exactly as the ending card
    // does before handing its redirect over. The survey-ui CTA opens the URL itself and applies the same
    // check independently; both fire when a host supplies this callback, so gating only one leaves the
    // raw value reaching the other.
    if (element.buttonExternal && element.buttonUrl && onOpenExternalURL) {
      if (isSafeLinkUrl(element.buttonUrl)) {
        onOpenExternalURL(element.buttonUrl);
      } else {
        console.error("Refusing to open an unsafe CTA button URL");
      }
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
        buttonVariant="custom"
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
