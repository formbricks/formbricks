import { useEffect, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyPictureSelectionElement } from "@formbricks/types/surveys/elements";
import { ElementMedia } from "@/components/general/element-media";
import { Headline } from "@/components/general/headline";
import { Subheader } from "@/components/general/subheader";
import { ImageDownIcon } from "@/components/icons/image-down-icon";
import { getLocalizedValue } from "@/lib/i18n";
import { getOriginalFileNameFromUrl } from "@/lib/storage";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";

interface PictureSelectionProps {
  element: TSurveyPictureSelectionElement;
  value: string[];
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentElementId: string;
  dir?: "ltr" | "rtl" | "auto";
}

export function PictureSelectionElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  dir = "auto",
}: Readonly<PictureSelectionProps>) {
  const { t } = useTranslation();
  const [startTime, setStartTime] = useState(performance.now());
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>(() => {
    const initialLoadingState: Record<string, boolean> = {};
    element.choices.forEach((choice) => {
      initialLoadingState[choice.id] = true;
    });
    return initialLoadingState;
  });
  const isMediaAvailable = element.imageUrl || element.videoUrl;
  const isCurrent = element.id === currentElementId;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  const addItem = (item: string) => {
    let values: string[] = [];

    if (element.allowMulti) {
      values = [...value, item];
    } else {
      values = [item];
    }

    onChange({ [element.id]: values });
  };

  const removeItem = (item: string) => {
    let values: string[] = [];

    if (element.allowMulti) {
      values = value.filter((i) => i !== item);
    } else {
      values = [];
    }

    onChange({ [element.id]: values });
  };

  const handleChange = (id: string) => {
    if (value.includes(id)) {
      removeItem(id);
    } else {
      addItem(id);
    }
  };

  useEffect(() => {
    if (!element.allowMulti && value.length > 1) {
      onChange({ [element.id]: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- We only want to recompute when the allowMulti changes
  }, [element.allowMulti]);

  const elementChoices = element.choices;

  return (
    <form
      key={element.id}
      onSubmit={(e) => {
        e.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
      }}
      className="fb-w-full">
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
      <div className="fb-mt-4">
        <fieldset>
          <legend className="fb-sr-only">{t("common.options")}</legend>
          <div className="fb-bg-survey-bg fb-relative fb-grid fb-grid-cols-1 sm:fb-grid-cols-2 fb-gap-4">
            {elementChoices.map((choice) => (
              <div className="fb-relative" key={choice.id}>
                <button
                  type="button"
                  tabIndex={isCurrent ? 0 : -1}
                  onKeyDown={(e) => {
                    // Accessibility: if spacebar was pressed pass this down to the input
                    if (e.key === " ") {
                      e.preventDefault();
                      e.currentTarget.click();
                      e.currentTarget.focus();
                    }
                  }}
                  onClick={() => {
                    handleChange(choice.id);
                  }}
                  className={cn(
                    "fb-relative fb-w-full fb-cursor-pointer fb-overflow-hidden fb-border fb-rounded-custom focus-visible:fb-outline-none focus-visible:fb-ring-2 focus-visible:fb-ring-brand focus-visible:fb-ring-offset-2 fb-aspect-[4/3] fb-min-h-[7rem] fb-max-h-[50vh] group/image",
                    Array.isArray(value) && value.includes(choice.id)
                      ? "fb-border-brand fb-text-brand fb-z-10 fb-border-4 fb-shadow-sm"
                      : ""
                  )}>
                  {loadingImages[choice.id] && (
                    <div className="fb-absolute fb-inset-0 fb-flex fb-h-full fb-w-full fb-animate-pulse fb-items-center fb-justify-center fb-rounded-md fb-bg-slate-200" />
                  )}
                  <img
                    src={choice.imageUrl}
                    id={choice.id}
                    alt={getOriginalFileNameFromUrl(choice.imageUrl)}
                    className={cn(
                      "fb-h-full fb-w-full fb-object-cover",
                      loadingImages[choice.id] ? "fb-opacity-0" : ""
                    )}
                    onLoad={() => {
                      setLoadingImages((prev) => ({ ...prev, [choice.id]: false }));
                    }}
                    onError={() => {
                      setLoadingImages((prev) => ({ ...prev, [choice.id]: false }));
                    }}
                  />
                  {element.allowMulti ? (
                    <input
                      id={`${choice.id}-checked`}
                      name={`${choice.id}-checkbox`}
                      type="checkbox"
                      tabIndex={-1}
                      checked={value.includes(choice.id)}
                      className={cn(
                        "fb-border-border fb-rounded-custom fb-pointer-events-none fb-absolute fb-top-2 fb-z-20 fb-h-5 fb-w-5 fb-border",
                        value.includes(choice.id) ? "fb-border-brand fb-text-brand" : "",
                        dir === "rtl" ? "fb-left-2" : "fb-right-2"
                      )}
                      required={element.required && value.length === 0}
                    />
                  ) : (
                    <input
                      id={`${choice.id}-radio`}
                      name={`${element.id}`}
                      type="radio"
                      tabIndex={-1}
                      checked={value.includes(choice.id)}
                      className={cn(
                        "fb-border-border fb-pointer-events-none fb-absolute fb-top-2 fb-z-20 fb-h-5 fb-w-5 fb-rounded-full fb-border",
                        value.includes(choice.id) ? "fb-border-brand fb-text-brand" : "",
                        dir === "rtl" ? "fb-left-2" : "fb-right-2"
                      )}
                      required={element.required && value.length ? false : element.required}
                    />
                  )}
                </button>
                <a
                  tabIndex={-1}
                  href={choice.imageUrl}
                  target="_blank"
                  title={t("common.open_in_new_tab")}
                  rel="noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className={cn(
                    "fb-absolute fb-bottom-4 fb-flex fb-items-center fb-gap-2 fb-whitespace-nowrap fb-rounded-md fb-bg-slate-800 fb-bg-opacity-40 fb-p-1.5 fb-text-white fb-backdrop-blur-lg fb-transition fb-duration-300 fb-ease-in-out hover:fb-bg-opacity-65 group-hover/image:fb-opacity-100 fb-z-20",
                    dir === "rtl" ? "fb-left-2" : "fb-right-2"
                  )}>
                  <span className="fb-sr-only">{t("common.open_in_new_tab")}</span>
                  <ImageDownIcon />
                </a>
              </div>
            ))}
          </div>
        </fieldset>
      </div>
    </form>
  );
}
