import { BackButton } from "@/components/buttons/back-button";
import { SubmitButton } from "@/components/buttons/submit-button";
import { Headline } from "@/components/general/headline";
import { QuestionMedia } from "@/components/general/question-media";
import { Subheader } from "@/components/general/subheader";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn, getShuffledChoicesIds } from "@/lib/utils";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useCallback, useMemo, useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type {
  TSurveyQuestionChoice,
  TSurveyQuestionId,
  TSurveyRankingQuestion,
} from "@formbricks/types/surveys/types";

interface RankingQuestionProps {
  question: TSurveyRankingQuestion;
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

export function RankingQuestion({
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
  autoFocusEnabled,
  currentQuestionId,
  isBackButtonHidden,
}: RankingQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());
  const isCurrent = question.id === currentQuestionId;
  const shuffledChoicesIds = useMemo(() => {
    if (question.shuffleOption) {
      return getShuffledChoicesIds(question.choices, question.shuffleOption);
    }
    return question.choices.map((choice) => choice.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.shuffleOption, question.choices.length]);

  const [parent] = useAutoAnimate();

  const [error, setError] = useState<string | null>(null);
  const isMediaAvailable = question.imageUrl || question.videoUrl;

  useTtc(question.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  const [localValue, setLocalValue] = useState<string[]>(value ?? []);

  const sortedItems = useMemo(() => {
    return localValue
      .map((id) => question.choices.find((c) => c.id === id))
      .filter((item): item is TSurveyQuestionChoice => item !== undefined);
  }, [localValue, question.choices]);

  const unsortedItems = useMemo(() => {
    if (question.shuffleOption === "all" && sortedItems.length === 0) {
      return shuffledChoicesIds.map((id) => question.choices.find((c) => c.id === id));
    }
    return question.choices.filter((c) => !localValue.includes(c.id));
  }, [question.choices, question.shuffleOption, localValue, sortedItems, shuffledChoicesIds]);

  const handleItemClick = useCallback(
    (item: TSurveyQuestionChoice) => {
      const isAlreadySorted = localValue.includes(item.id);
      const newLocalValue = isAlreadySorted
        ? localValue.filter((id) => id !== item.id)
        : [...localValue, item.id];

      setLocalValue(newLocalValue);

      setError(null);
    },
    [localValue]
  );

  const handleMove = useCallback(
    (itemId: string, direction: "up" | "down") => {
      const index = localValue.findIndex((id) => id === itemId);
      if (index === -1) return;

      const newLocalValue = [...localValue];
      const [movedItem] = newLocalValue.splice(index, 1);
      const newIndex =
        direction === "up" ? Math.max(0, index - 1) : Math.min(newLocalValue.length, index + 1);
      newLocalValue.splice(newIndex, 0, movedItem);
      setLocalValue(newLocalValue);

      setError(null);
    },
    [localValue]
  );

  const handleSubmit = (e: Event) => {
    e.preventDefault();

    const hasIncompleteRanking =
      (question.required && sortedItems.length !== question.choices.length) ||
      (!question.required && sortedItems.length > 0 && sortedItems.length < question.choices.length);

    if (hasIncompleteRanking) {
      setError("Please rank all items before submitting.");
      return;
    }

    const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
    onChange({
      [question.id]: sortedItems.map((item) => getLocalizedValue(item.label, languageCode)),
    });
    onSubmit(
      { [question.id]: sortedItems.map((item) => getLocalizedValue(item.label, languageCode)) },
      updatedTtcObj
    );
  };

  const handleBack = () => {
    const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
    onChange({
      [question.id]: sortedItems.map((item) => getLocalizedValue(item.label, languageCode)),
    });
    onBack();
  };

  return (
    <form onSubmit={handleSubmit} className="fb:w-full">
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
              <legend className="fb:sr-only">Ranking Items</legend>
              <div className="fb:relative" ref={parent}>
                {[...sortedItems, ...unsortedItems].map((item, idx) => {
                  if (!item) return null;
                  const isSorted = sortedItems.includes(item);
                  const isFirst = isSorted && idx === 0;
                  const isLast = isSorted && idx === sortedItems.length - 1;

                  return (
                    <div
                      key={item.id}
                      tabIndex={isCurrent ? 0 : -1}
                      onKeyDown={(e) => {
                        if (e.key === " ") {
                          handleItemClick(item);
                        }
                      }}
                      className={cn(
                        "fb:flex fb:h-12 fb:items-center fb:mb-2 fb:border fb:border-border fb:transition-all fb:text-heading fb:focus-within:border-brand fb:hover:bg-input-bg-selected fb:focus:bg-input-bg-selected fb:rounded-custom fb:relative fb:cursor-pointer fb:focus:outline-hidden fb:transform fb:duration-500 fb:ease-in-out",
                        isSorted ? "fb:bg-input-bg-selected" : "fb:bg-input-bg"
                      )}
                      autoFocus={idx === 0 && autoFocusEnabled}>
                      <div
                        className="fb:flex fb:gap-x-4 fb:px-4 fb:items-center fb:grow fb:h-full group"
                        onClick={() => {
                          handleItemClick(item);
                        }}>
                        <span
                          className={cn(
                            "fb:w-6 fb:grow-0 fb:h-6 fb:flex fb:items-center fb:justify-center fb:rounded-full fb:text-xs fb:font-semibold fb:border-brand fb:border",
                            isSorted
                              ? "fb:bg-brand fb:text-white fb:border"
                              : "fb:border-dashed fb:group-hover:bg-white fb:text-transparent fb:group-hover:text-heading"
                          )}>
                          {(idx + 1).toString()}
                        </span>
                        <div className="fb:grow fb:shrink fb:font-medium fb:text-sm">
                          {getLocalizedValue(item.label, languageCode)}
                        </div>
                      </div>
                      {isSorted ? (
                        <div className="fb:flex fb:flex-col fb:h-full fb:grow-0 fb:border-l fb:border-border">
                          <button
                            tabIndex={-1}
                            type="button"
                            onClick={() => {
                              handleMove(item.id, "up");
                            }}
                            className={cn(
                              "fb:px-2 fb:flex fb:flex-1 fb:items-center fb:justify-center",
                              isFirst
                                ? "fb:opacity-30 fb:cursor-not-allowed"
                                : "fb:hover:bg-black/5 fb:rounded-tr-custom fb:transition-colors"
                            )}
                            disabled={isFirst}>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="lucide lucide-chevron-up">
                              <path d="m18 15-6-6-6 6" />
                            </svg>
                          </button>
                          <button
                            tabIndex={-1}
                            type="button"
                            onClick={() => {
                              handleMove(item.id, "down");
                            }}
                            className={cn(
                              "fb:px-2 fb:flex-1 fb:border-t fb:border-border fb:flex fb:items-center fb:justify-center",
                              isLast
                                ? "fb:opacity-30 fb:cursor-not-allowed"
                                : "fb:hover:bg-black/5 fb:rounded-br-custom fb:transition-colors"
                            )}
                            disabled={isLast}>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="lucide lucide-chevron-down">
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          </div>
          {error ? <div className="fb:text-red-500 fb:mt-2 fb:text-sm">{error}</div> : null}
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
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            tabIndex={isCurrent ? 0 : -1}
            onClick={handleBack}
          />
        )}
      </div>
    </form>
  );
}
