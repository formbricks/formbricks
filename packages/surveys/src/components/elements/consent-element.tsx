import { useCallback, useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyConsentElement } from "@formbricks/types/surveys/elements";
import { ElementMedia } from "@/components/general/element-media";
import { Headline } from "@/components/general/headline";
import { Subheader } from "@/components/general/subheader";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface ConsentElementProps {
  element: TSurveyConsentElement;
  value: string;
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentElementId: string;
  dir?: "ltr" | "rtl" | "auto";
}

export function ConsentElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  autoFocusEnabled,
  dir = "auto",
}: Readonly<ConsentElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = element.imageUrl || element.videoUrl;

  useTtc(element.id, ttc, setTtc, startTime, setStartTime, element.id === currentElementId);

  const consentRef = useCallback(
    (currentElement: HTMLLabelElement | null) => {
      // will focus on current element when the element ID matches the current element
      if (element.id && currentElement && autoFocusEnabled && element.id === currentElementId) {
        currentElement.focus();
      }
    },
    [element.id, autoFocusEnabled, currentElementId]
  );

  return (
    <form
      key={element.id}
      onSubmit={(e) => {
        e.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
      }}>
      {isMediaAvailable ? <ElementMedia imgUrl={element.imageUrl} videoUrl={element.videoUrl} /> : null}
      <Headline
        headline={getLocalizedValue(element.headline, languageCode)}
        elementId={element.id}
        required={element.required}
      />
      <Subheader
        subheader={element.subheader ? getLocalizedValue(element.subheader, languageCode) : ""}
        elementId={element.id}
      />
      <label
        ref={consentRef}
        tabIndex={0} // NOSONAR - needed for keyboard navigation through options
        id={`${element.id}-label`}
        onKeyDown={(e) => {
          // Accessibility: if spacebar was pressed pass this down to the input
          if (e.key === " ") {
            e.preventDefault();
            document.getElementById(element.id)?.click();
            document.getElementById(`${element.id}-label`)?.focus();
          }
        }}
        className="fb-border-border fb-bg-input-bg fb-text-heading hover:fb-bg-input-bg-selected focus:fb-bg-input-bg-selected focus:fb-ring-brand fb-rounded-custom fb-relative fb-z-10 fb-my-2 fb-flex fb-w-full fb-cursor-pointer fb-items-center fb-border fb-p-4 fb-text-sm focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2">
        <input
          tabIndex={-1}
          type="checkbox"
          dir={dir}
          id={element.id}
          name={element.id}
          value={getLocalizedValue(element.label, languageCode)}
          onChange={(e) => {
            if (e.target instanceof HTMLInputElement && e.target.checked) {
              onChange({ [element.id]: "accepted" });
            } else {
              onChange({ [element.id]: "" });
            }
          }}
          checked={value === "accepted"}
          className="fb-border-brand fb-text-brand fb-h-4 fb-w-4 fb-border focus:fb-ring-0 focus:fb-ring-offset-0"
          aria-labelledby={`${element.id}-label`}
          required={element.required}
        />
        <span className="fb-ml-3 fb-mr-3 fb-font-medium fb-flex-1" dir="auto">
          {getLocalizedValue(element.label, languageCode)}
        </span>
      </label>
    </form>
  );
}
