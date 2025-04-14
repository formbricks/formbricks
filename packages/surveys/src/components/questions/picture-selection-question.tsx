import { BackButton } from "@/components/buttons/back-button";
import { SubmitButton } from "@/components/buttons/submit-button";
import { Headline } from "@/components/general/headline";
import { QuestionMedia } from "@/components/general/question-media";
import { Subheader } from "@/components/general/subheader";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { getOriginalFileNameFromUrl } from "@/lib/storage";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyPictureSelectionQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";

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
      className="fb:w-full">
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
          <div className="fb:mt-4">
            <fieldset>
              <legend className="fb:sr-only">Options</legend>
              <div className="fb:bg-survey-bg fb:relative fb:grid fb:grid-cols-2 fb:gap-4">
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
                      "fb:relative fb:w-full fb:cursor-pointer fb:overflow-hidden fb:border fb:rounded-custom fb:focus:outline-hidden fb:aspect-4/3 fb:min-h-[7rem] fb:max-h-[50vh] fb:focus:border-brand fb:focus:border-4 group/image",
                      Array.isArray(value) && value.includes(choice.id)
                        ? "fb:border-brand fb:text-brand fb:z-10 fb:border-4 fb:shadow-sm"
                        : ""
                    )}>
                    <img
                      src={choice.imageUrl}
                      id={choice.id}
                      alt={getOriginalFileNameFromUrl(choice.imageUrl)}
                      className="fb:h-full fb:w-full fb:object-cover"
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
                      className="fb:absolute fb:bottom-2 fb:right-2 fb:flex fb:items-center fb:gap-2 fb:whitespace-nowrap fb:rounded-md fb:bg-slate-800 fb:bg-opacity-40 fb:p-1.5 fb:text-white fb:opacity-0 fb:backdrop-blur-lg fb:transition fb:duration-300 fb:ease-in-out fb:hover:bg-opacity-65 fb:group-hover/image:opacity-100">
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
                          "fb:border-border fb:rounded-custom fb:pointer-events-none fb:absolute fb:right-2 fb:top-2 fb:z-20 fb:h-5 fb:w-5 fb:border",
                          value.includes(choice.id) ? "fb:border-brand fb:text-brand" : ""
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
                          "fb:border-border fb:pointer-events-none fb:absolute fb:right-2 fb:top-2 fb:z-20 fb:h-5 fb:w-5 fb:rounded-full fb:border",
                          value.includes(choice.id) ? "fb:border-brand fb:text-brand" : ""
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
      <div className="fb:flex fb:flex-row-reverse fb:w-full fb:justify-between fb:px-6 fb:py-4">
        <SubmitButton
          tabIndex={isCurrent ? 0 : -1}
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
        />
        {!isFirstQuestion && !isBackButtonHidden && (
          <BackButton
            tabIndex={isCurrent ? 0 : -1}
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedTtcObj);
              onBack();
            }}
          />
        )}
      </div>
    </form>
  );
}
