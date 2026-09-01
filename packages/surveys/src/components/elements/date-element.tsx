import { useEffect, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { DateElement as SurveyUIDateElement } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyDateElement } from "@formbricks/types/surveys/elements";
import { TSurveyLanguage } from "@formbricks/types/surveys/types";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { getDateBoundsFromRules, toISODateString } from "@/lib/validation/validators/date-utils";

interface DateElementProps {
  element: TSurveyDateElement;
  value: string;
  onChange: (responseData: TResponseData) => void;
  autoFocus?: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentElementId: string;
  errorMessage?: string;
  surveyLanguages: TSurveyLanguage[];
  dir?: "ltr" | "rtl" | "auto";
}

export function DateElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  errorMessage,
  surveyLanguages,
  dir = "auto",
}: Readonly<DateElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isCurrent = element.id === currentElementId;
  const isRequired = element.required;
  const { t } = useTranslation();
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  const handleChange = (dateValue: string) => {
    onChange({ [element.id]: dateValue });
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    // Update TTC when form is submitted (for TTC collection)
    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  // Relative bounds are anchored to "today", so a survey left open across local midnight would
  // otherwise keep offering yesterday's window while the validators resolve the new one on submit.
  // Re-anchor once the day rolls over.
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const nextMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const timer = setTimeout(() => {
      setToday(new Date());
    }, nextMidnight.getTime() - Date.now());

    return () => {
      clearTimeout(timer);
    };
  }, [today]);

  // Restrict the calendar to whatever the element's date validation rules allow, so a respondent
  // cannot pick a date the evaluator would reject on submit. Falls back to a +/-100 year span when
  // no rule bounds that end of the range.
  const { minDate, maxDate } = getDateBoundsFromRules(element, today);

  const getMinDate = (): string => {
    return minDate ?? toISODateString(new Date(today.getFullYear() - 100, 0, 1));
  };

  const getMaxDate = (): string => {
    return maxDate ?? toISODateString(new Date(today.getFullYear() + 100, 0, 1));
  };

  return (
    <form key={element.id} onSubmit={handleSubmit} className="w-full">
      <SurveyUIDateElement
        elementId={element.id}
        inputId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        value={value}
        onChange={handleChange}
        minDate={getMinDate()}
        maxDate={getMaxDate()}
        required={isRequired}
        requiredLabel={t("common.required")}
        errorMessage={errorMessage}
        locale={
          languageCode === "default"
            ? surveyLanguages.find((language) => language.default)?.language.code
            : languageCode
        }
        dir={dir}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
