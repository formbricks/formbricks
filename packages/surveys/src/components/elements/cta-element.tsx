import { useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyCTAElement } from "@formbricks/types/surveys/elements";
import { ElementMedia } from "@/components/general/element-media";
import { Headline } from "@/components/general/headline";
import { Subheader } from "@/components/general/subheader";
import { LinkIcon } from "@/components/icons/link-icon";
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
  const isMediaAvailable = element.imageUrl || element.videoUrl;
  const isCurrent = element.id === currentElementId;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  const handleExternalButtonClick = () => {
    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
    onChange({ [element.id]: "clicked" });

    if (element.buttonUrl) {
      if (onOpenExternalURL) {
        onOpenExternalURL(element.buttonUrl);
      } else {
        window.open(element.buttonUrl, "_blank")?.focus();
      }
    }
  };

  return (
    <div key={element.id}>
      <div>
        {isMediaAvailable ? <ElementMedia imgUrl={element.imageUrl} videoUrl={element.videoUrl} /> : null}
        <Headline
          headline={getLocalizedValue(element.headline, languageCode)}
          elementId={element.id}
          required={true}
        />
        <Subheader
          subheader={element.subheader ? getLocalizedValue(element.subheader, languageCode) : ""}
          elementId={element.id}
        />
        {element.buttonExternal && (
          <div className="fb-flex fb-flex-row-reverse fb-w-full fb-justify-between fb-pt-4">
            <div className="fb-flex fb-flex-row-reverse fb-w-full fb-justify-start">
              <button
                dir="auto"
                type="button"
                tabIndex={0}
                onClick={handleExternalButtonClick}
                className="fb-text-heading focus:fb-ring-focus fb-flex fb-items-center fb-rounded-md fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2">
                {getLocalizedValue(element.ctaButtonLabel, languageCode)}
                <LinkIcon className="fb-ml-2 fb-h-4 fb-w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
