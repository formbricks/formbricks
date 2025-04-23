import { useEffect, useState } from "react";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyPictureSelectionQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { getLocalizedValue } from "../../lib/i18n";
import { getOriginalFileNameFromUrl } from "../../lib/storage";
import { getUpdatedTtc, useTtc } from "../../lib/ttc";
import { cn } from "../../lib/utils";
import { BackButton } from "../buttons/back-button";
import { SubmitButton } from "../buttons/submit-button";
import { Headline } from "../general/headline";
import { QuestionMedia } from "../general/question-media";
import { Subheader } from "../general/subheader";
import { ScrollableContainer } from "../wrappers/scrollable-container";

interface PictureSelectionProps {
  question: TSurveyPictureSelectionQuestion;
  value: string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentQuestionId: TSurveyQuestionId;
  isBackButtonHidden: boolean;
}

export function PictureSelectionQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId,
  isBackButtonHidden,
}: PictureSelectionProps) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const isCurrent = question.id === currentQuestionId;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  const addItem = (item: string) => {
    let values: string[] = [];

    if (question.allowMulti) {
      values = [...value, item];
    } else {
      values = [item];
    }

    onChange({ [question.id]: values });
  };

  const removeItem = (item: string) => {
    let values: string[] = [];

    if (question.allowMulti) {
      values = value.filter((i) => i !== item);
    } else {
      values = [];
    }

    onChange({ [question.id]: values });
  };

  const handleChange = (id: string) => {
    if (value.includes(id)) {
      removeItem(id);
    } else {
      addItem(id);
    }
  };

  useEffect(() => {
    if (!question.allowMulti && value.length > 1) {
      onChange({ [question.id]: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- We only want to recompute when the allowMulti changes
  }, [question.allowMulti]);

  const questionChoices = question.choices;

  return (
    <form
      key={question.id}
      onSubmit={(e) => {
        e.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value }, updatedTtcObj);
      }}
      className="w-full">
      <ScrollableContainer>
        <div>
          {isMediaAvailable ? (
            <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />
          ) : null}
          <Headline
            headline={getLocalizedValue(question.headline, languageCode)}
            questionId={question.id}
            required={question.required}
          />
          <Subheader
            subheader={question.subheader ? getLocalizedValue(question.subheader, languageCode) : ""}
            questionId={question.id}
          />
          <div className="mt-4">
            <fieldset>
              <legend className="sr-only">Options</legend>
              <div className="bg-survey-bg relative grid grid-cols-2 gap-4">
                {questionChoices.map((choice) => (
                  <label
                    key={choice.id}
                    tabIndex={isCurrent ? 0 : -1}
                    htmlFor={choice.id}
                    onKeyDown={(e) => {
                      // Accessibility: if spacebar was pressed pass this down to the input
                      if (e.key === " ") {
                        e.preventDefault();
                        document.getElementById(choice.id)?.click();
                        document.getElementById(choice.id)?.focus();
                      }
                    }}
                    onClick={() => {
                      handleChange(choice.id);
                    }}
                    className={cn(
                      "rounded-custom focus:border-brand group/image relative aspect-[4/3] max-h-[50vh] min-h-[7rem] w-full cursor-pointer overflow-hidden border focus:border-4 focus:outline-none",
                      Array.isArray(value) && value.includes(choice.id)
                        ? "border-brand text-brand z-10 border-4 shadow-sm"
                        : ""
                    )}>
                    <img
                      src={choice.imageUrl}
                      id={choice.id}
                      alt={getOriginalFileNameFromUrl(choice.imageUrl)}
                      className="h-full w-full object-cover"
                    />
                    <a
                      tabIndex={-1}
                      href={choice.imageUrl}
                      target="_blank"
                      title="Open in new tab"
                      rel="noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="absolute bottom-2 right-2 flex items-center gap-2 whitespace-nowrap rounded-md bg-slate-800 bg-opacity-40 p-1.5 text-white opacity-0 backdrop-blur-lg transition duration-300 ease-in-out hover:bg-opacity-65 group-hover/image:opacity-100">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-expand">
                        <path d="m21 21-6-6m6 6v-4.8m0 4.8h-4.8" />
                        <path d="M3 16.2V21m0 0h4.8M3 21l6-6" />
                        <path d="M21 7.8V3m0 0h-4.8M21 3l-6 6" />
                        <path d="M3 7.8V3m0 0h4.8M3 3l6 6" />
                      </svg>
                    </a>
                    {question.allowMulti ? (
                      <input
                        id={`${choice.id}-checked`}
                        name={`${choice.id}-checkbox`}
                        type="checkbox"
                        tabIndex={-1}
                        checked={value.includes(choice.id)}
                        className={cn(
                          "border-border rounded-custom pointer-events-none absolute right-2 top-2 z-20 h-5 w-5 border",
                          value.includes(choice.id) ? "border-brand text-brand" : ""
                        )}
                        required={question.required && value.length ? false : question.required}
                      />
                    ) : (
                      <input
                        id={`${choice.id}-radio`}
                        name={`${choice.id}-radio`}
                        type="radio"
                        tabIndex={-1}
                        checked={value.includes(choice.id)}
                        className={cn(
                          "border-border pointer-events-none absolute right-2 top-2 z-20 h-5 w-5 rounded-full border",
                          value.includes(choice.id) ? "border-brand text-brand" : ""
                        )}
                        required={question.required && value.length ? false : question.required}
                      />
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>
      </ScrollableContainer>
      <div className="flex w-full flex-row-reverse justify-between px-6 py-4">
        {!isFirstQuestion && !isBackButtonHidden ? (
          <BackButton
            tabIndex={isCurrent ? 0 : -1}
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedTtcObj);
              onBack();
            }}
          />
        ) : (
          <div />
        )}
        <div />
        <SubmitButton
          tabIndex={isCurrent ? 0 : -1}
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
        />
      </div>
    </form>
  );
}
