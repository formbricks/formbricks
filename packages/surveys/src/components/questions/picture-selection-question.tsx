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
}: Readonly<PictureSelectionProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>(() => {
    const initialLoadingState: Record<string, boolean> = {};
    question.choices.forEach((choice) => {
      initialLoadingState[choice.id] = true;
    });
    return initialLoadingState;
  });
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
    <ScrollableContainer>
      <form
        key={question.id}
        onSubmit={(e) => {
          e.preventDefault();
          const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
          setTtc(updatedTtcObj);
          onSubmit({ [question.id]: value }, updatedTtcObj);
        }}
        className="fb-w-full">
        {isMediaAvailable ? <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} /> : null}
        <Headline
          headline={getLocalizedValue(question.headline, languageCode)}
          questionId={question.id}
          required={question.required}
        />
        <Subheader
          subheader={question.subheader ? getLocalizedValue(question.subheader, languageCode) : ""}
          questionId={question.id}
        />
        <div className="fb-mt-4">
          <fieldset>
            <legend className="fb-sr-only">Options</legend>
            <div className="fb-bg-survey-bg fb-relative fb-grid fb-grid-cols-1 sm:fb-grid-cols-2 fb-gap-4">
              {questionChoices.map((choice) => (
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
                    {question.allowMulti ? (
                      <input
                        id={`${choice.id}-checked`}
                        name={`${choice.id}-checkbox`}
                        type="checkbox"
                        tabIndex={-1}
                        checked={value.includes(choice.id)}
                        className={cn(
                          "fb-border-border fb-rounded-custom fb-pointer-events-none fb-absolute fb-right-2 fb-top-2 fb-z-20 fb-h-5 fb-w-5 fb-border",
                          value.includes(choice.id) ? "fb-border-brand fb-text-brand" : ""
                        )}
                        required={question.required && value.length === 0}
                      />
                    ) : (
                      <input
                        id={`${choice.id}-radio`}
                        name={`${question.id}`}
                        type="radio"
                        tabIndex={-1}
                        checked={value.includes(choice.id)}
                        className={cn(
                          "fb-border-border fb-pointer-events-none fb-absolute fb-right-2 fb-top-2 fb-z-20 fb-h-5 fb-w-5 fb-rounded-full fb-border",
                          value.includes(choice.id) ? "fb-border-brand fb-text-brand" : ""
                        )}
                        required={question.required && value.length ? false : question.required}
                      />
                    )}
                  </button>
                  <a
                    tabIndex={-1}
                    href={choice.imageUrl}
                    target="_blank"
                    title="Open in new tab"
                    rel="noreferrer"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="fb-absolute fb-bottom-4 fb-right-2 fb-flex fb-items-center fb-gap-2 fb-whitespace-nowrap fb-rounded-md fb-bg-slate-800 fb-bg-opacity-40 fb-p-1.5 fb-text-white fb-backdrop-blur-lg fb-transition fb-duration-300 fb-ease-in-out hover:fb-bg-opacity-65 group-hover/image:fb-opacity-100 fb-z-20">
                    <span className="fb-sr-only">Open in new tab</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="lucide lucide-image-down-icon lucide-image-down">
                      <path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21" />
                      <path d="m14 19 3 3v-5.5" />
                      <path d="m17 22 3-3" />
                      <circle cx="9" cy="9" r="2" />
                    </svg>
                  </a>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="fb-flex fb-flex-row-reverse fb-w-full fb-justify-between fb-pt-4">
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
    </ScrollableContainer>
  );
}
