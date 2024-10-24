import { BackButton } from "@/components/buttons/BackButton";
import { SubmitButton } from "@/components/buttons/SubmitButton";
import { Headline } from "@/components/general/Headline";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import { Subheader } from "@/components/general/Subheader";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn, getShuffledChoicesIds } from "@/lib/utils";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useCallback, useMemo, useState } from "preact/hooks";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
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
}

export const RankingQuestion = ({
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
}: RankingQuestionProps) => {
  const [startTime, setStartTime] = useState(performance.now());
  const isCurrent = question.id === currentQuestionId;
  const shuffledChoicesIds = useMemo(() => {
    if (question.shuffleOption) {
      return getShuffledChoicesIds(question.choices, question.shuffleOption);
    } else return question.choices.map((choice) => choice.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.shuffleOption, question.choices.length]);

  const [parent] = useAutoAnimate();

  const [error, setError] = useState<string | null>(null);

  const isMediaAvailable = question.imageUrl || question.videoUrl;

  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);

  const sortedItems = useMemo(() => {
    return value
      .map((id) => question.choices.find((c) => c.id === id))
      .filter((item): item is TSurveyQuestionChoice => item !== undefined);
  }, [value, question.choices]);

  const unsortedItems = useMemo(() => {
    if (question.shuffleOption === "all" && sortedItems.length === 0) {
      return shuffledChoicesIds.map((id) => question.choices.find((c) => c.id === id));
    } else {
      return question.choices.filter((c) => !value.includes(c.id));
    }
  }, [question.choices, value, question.shuffleOption]);

  const handleItemClick = useCallback(
    (item: TSurveyQuestionChoice) => {
      const isAlreadySorted = sortedItems.some((sortedItem) => sortedItem.id === item.id);
      const newSortedItems = isAlreadySorted
        ? sortedItems.filter((sortedItem) => sortedItem.id !== item.id)
        : [...sortedItems, item];
      onChange({ [question.id]: newSortedItems.map((item) => getLocalizedValue(item.label, languageCode)) });
      setError(null);
    },
    [onChange, question.id, sortedItems]
  );

  const handleMove = useCallback(
    (itemId: string, direction: "up" | "down") => {
      const index = sortedItems.findIndex((item) => item.id === itemId);
      if (index === -1) return;

      const newSortedItems = [...sortedItems];
      const [movedItem] = newSortedItems.splice(index, 1);
      const newIndex =
        direction === "up" ? Math.max(0, index - 1) : Math.min(newSortedItems.length, index + 1);

      newSortedItems.splice(newIndex, 0, movedItem);
      onChange({ [question.id]: newSortedItems.map((item) => getLocalizedValue(item.label, languageCode)) });
      setError(null);
    },
    [sortedItems, onChange, question.id]
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
    onSubmit(
      { [question.id]: sortedItems.map((item) => getLocalizedValue(item.label, languageCode)) },
      updatedTtcObj
    );
  };

  return (
    <form onSubmit={handleSubmit} className="fb-w-full">
      <ScrollableContainer>
        <div>
          {isMediaAvailable && <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />}
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
              <legend className="fb-sr-only">Ranking Items</legend>
              <div className="fb-relative" ref={parent}>
                {[...sortedItems, ...unsortedItems].map((item, idx) => {
                  if (!item) return;
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
                        "fb-flex fb-h-12 fb-items-center fb-mb-2 fb-border fb-border-border fb-transition-all fb-text-heading focus-within:fb-border-brand hover:fb-bg-input-bg-selected focus:fb-bg-input-bg-selected fb-rounded-custom fb-relative fb-cursor-pointer focus:fb-outline-none fb-transform fb-duration-500 fb-ease-in-out",
                        isSorted ? "fb-bg-input-bg-selected" : "fb-bg-input-bg"
                      )}
                      autoFocus={idx === 0 && autoFocusEnabled}>
                      <div
                        className="fb-flex fb-gap-x-4 fb-px-4 fb-items-center fb-grow fb-h-full group"
                        onClick={() => handleItemClick(item)}>
                        <span
                          className={cn(
                            "fb-w-6 fb-grow-0 fb-h-6 fb-flex fb-items-center fb-justify-center fb-rounded-full fb-text-xs fb-font-semibold fb-border-brand fb-border",
                            isSorted
                              ? "fb-bg-brand fb-text-white fb-border"
                              : "fb-border-dashed group-hover:fb-bg-white fb-text-transparent group-hover:fb-text-heading"
                          )}>
                          {(idx + 1).toString()}
                        </span>
                        <div className="fb-grow fb-shrink fb-font-medium fb-text-sm">
                          {getLocalizedValue(item.label, languageCode)}
                        </div>
                      </div>
                      {isSorted && (
                        <div className="fb-flex fb-flex-col fb-h-full fb-grow-0 fb-border-l fb-border-border">
                          <button
                            tabIndex={-1}
                            type="button"
                            onClick={() => handleMove(item.id, "up")}
                            className={cn(
                              "fb-px-2 fb-flex fb-flex-1 fb-items-center fb-justify-center",
                              isFirst
                                ? "fb-opacity-30 fb-cursor-not-allowed"
                                : "hover:fb-bg-black/5 fb-rounded-tr-custom fb-transition-colors"
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
                            onClick={() => handleMove(item.id, "down")}
                            className={cn(
                              "fb-px-2 fb-flex-1 fb-border-t fb-border-border fb-flex fb-items-center fb-justify-center",
                              isLast
                                ? "fb-opacity-30 fb-cursor-not-allowed"
                                : "hover:fb-bg-black/5 fb-rounded-br-custom fb-transition-colors"
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
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          </div>
          {error && <div className="fb-text-red-500 fb-mt-2 fb-text-sm">{error}</div>}
        </div>
      </ScrollableContainer>

      <div className="fb-flex fb-flex-row-reverse fb-w-full fb-justify-between fb-px-6 fb-py-4">
        <SubmitButton
          tabIndex={isCurrent ? 0 : -1}
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
        />
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            tabIndex={isCurrent ? 0 : -1}
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
};
