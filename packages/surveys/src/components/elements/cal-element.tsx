import { useCallback, useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyCalElement } from "@formbricks/types/surveys/elements";
import { CalEmbed } from "@/components/general/cal-embed";
import { ElementMedia } from "@/components/general/element-media";
import { Headline } from "@/components/general/headline";
import { Subheader } from "@/components/general/subheader";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface CalElementProps {
  element: TSurveyCalElement;
  value: string;
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  currentElementId: string;
  errorMessage?: string;
}

export function CalElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  errorMessage,
}: Readonly<CalElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = element.imageUrl || element.videoUrl;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, element.id === currentElementId);

  const onSuccessfulBooking = useCallback(() => {
    onChange({ [element.id]: "booked" });
    const updatedttc = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedttc);
  }, [onChange, element.id, setTtc, startTime, ttc]);

  return (
    <form
      key={element.id}
      onSubmit={(e) => {
        e.preventDefault();
        // Validation is handled by centralized system, just update TTC
        const updatedttc = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
        setTtc(updatedttc);

        onChange({ [element.id]: value });
      }}
      className="w-full">
      <div>
        {isMediaAvailable ? <ElementMedia imgUrl={element.imageUrl} videoUrl={element.videoUrl} /> : null}
        <Headline
          headline={getLocalizedValue(element.headline, languageCode)}
          elementId={element.id}
          validationRules={element.validationRules}
        />
        <Subheader
          subheader={element.subheader ? getLocalizedValue(element.subheader, languageCode) : ""}
          elementId={element.id}
        />
        <CalEmbed key={element.id} element={element} onSuccessfulBooking={onSuccessfulBooking} />
        {errorMessage ? <span className="text-red-500">{errorMessage}</span> : null}
      </div>
    </form>
  );
}
